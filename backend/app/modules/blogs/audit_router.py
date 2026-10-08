import json
from datetime import datetime, timedelta
from typing import Any, List

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select, or_

from app.core.datetimes import utc_now
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, NotFoundError
from app.core.permissions import Permissions
from app.core.plans import get_blog_limits
from app.core.security import get_current_user
from app.models import AuditLog, Blog, User
from app.models.blog import BlogRole
from app.schemas import AuditLogActor, AuditLogFilters, AuditLogQueryParams, AuditLogRead

router = APIRouter(prefix="/blogs/{blog_id}/audit-logs", tags=["Audit Log"])


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    return " ".join(part for part in (user.first_name, user.last_name) if part) or None


def _to_audit_log_read(log: AuditLog, actor_name: str | None = None) -> AuditLogRead:
    try:
        details = json.loads(log.details) if log.details else {}
    except (TypeError, json.JSONDecodeError):
        details = {}

    return AuditLogRead(
        id=log.id,
        actor_user_id=log.actor_user_id,
        actor_email=log.actor_email,
        actor=log.actor_email,
        actor_name=actor_name,
        action=log.action,
        resource_type=log.resource_type,
        target_type=log.resource_type,
        resource_id=log.resource_id,
        blog_id=log.blog_id,
        details=details,
        description=_describe(log, details),
        # Deliberately omitted: this workspace-scoped log is visible to
        # owners AND editors, and covers every actor including ordinary
        # commenters, not just team members. Neither role has an
        # operational need for anyone else's IP/device — that's a
        # self-service (my own activity) and superadmin (abuse
        # investigation) concern, not a workspace-management one.
        ip_address=None,
        user_agent=None,
        created_at=log.created_at,
    )


ROLE_LABELS = {
    "owner": "Owner",
    "editor": "Editor",
    "author": "Author",
    "viewer": "Viewer",
}


def _role_label(role: Any) -> str:
    if isinstance(role, str):
        return ROLE_LABELS.get(role.lower(), role)
    return str(role) if role is not None else "unknown"


SETTINGS_LABELS = {
    "general": "general settings",
    "about": "the About page",
    "footer": "the footer",
    "seo": "SEO settings",
    "contact": "the contact page",
}


def _with_fields(base: str, changes: Any) -> str:
    """'Updated SEO settings: meta title, meta description'"""
    if not isinstance(changes, dict) or not changes:
        return base
    return f"{base}: {', '.join(field.replace('_', ' ') for field in changes)}"


def _format_datetime_label(value: Any) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
        return parsed.strftime("%b %d, %Y at %I:%M %p UTC")
    except (ValueError, TypeError):
        return None


def _describe(log: AuditLog, details: dict[str, Any]) -> str:
    """
    Generates active-voice, human-readable action descriptions, using the
    richer before/after shapes logged for the highest-value actions
    (member roles, settings, blog details, platform settings, profile
    updates, status toggles) where available, falling back to a plain
    action label otherwise.
    """
    action = log.action.lower()

    # Extract target email across common payload naming conventions
    target_email = (
        details.get("email")
        or details.get("member_email")
        or details.get("target_email")
        or details.get("user_email")
    )

    # Target label fallback: Use target email if present, else fallback to Resource ID
    if target_email:
        target_label = target_email
    elif log.resource_id:
        target_label = f"member #{log.resource_id}"
    else:
        target_label = "team member"

    # --- Team Member Actions ---
    if "member_permissions_update" in action or "member_role_update" in action or "member.updated" in action:
        role_change = details.get("changes", {}).get("role") if isinstance(details.get("changes"), dict) else None
        if role_change:
            return f"Changed {target_label}'s role from {_role_label(role_change.get('from'))} to {_role_label(role_change.get('to'))}"
        return f"Updated permissions for {target_label}"

    if "member_add" in action or "member.added" in action:
        role = details.get("role")
        return f"Added {target_label} to workspace" + (f" as {_role_label(role)}" if role else "")

    if "member_remove" in action or "member.removed" in action:
        role = details.get("role")
        return f"Removed {target_label} from workspace" + (f" ({_role_label(role)})" if role else "")

    # --- Post / Content Actions ---
    # Posts encode status in the action name itself (post.published, post.draft,
    # post.scheduled) rather than post.created, so these are handled by exact
    # action match rather than substring, ahead of the generic create/update checks.
    title = details.get("title")
    if action == "post.deleted" or "post_delete" in action:
        return f'Deleted post "{title}"' if title else "Deleted a post"
    if action == "post.updated" or "post_update" in action:
        return f'Updated post "{title}"' if title else "Updated a post"
    if action == "post.published":
        return f'Published post "{title}"' if title else "Published a post"
    if action == "post.scheduled":
        when = _format_datetime_label(details.get("published_at"))
        base = f'Scheduled post "{title}"' if title else "Scheduled a post"
        return f"{base} for {when}" if when else base
    if action == "post.draft":
        return f'Saved post "{title}" as a draft' if title else "Saved a post as a draft"
    if "post.created" in action or "post_create" in action:
        return f'Created post "{title}"' if title else "Created a new post"

    # --- Workspace & Settings Actions ---
    # These name the fields that changed rather than inlining the values \u2014
    # settings values can be whole paragraphs (the About page), and the
    # activity log shows the before/after per field when an entry is opened.
    if "settings.updated" in action or "branding.updated" in action:
        label = "branding" if "branding" in action else SETTINGS_LABELS.get(details.get("key"), "workspace settings")
        return _with_fields(f"Updated {label}", details.get("changes"))

    if "blog.update" in action or "blog_update" in action:
        return _with_fields("Updated workspace details", details.get("changes"))

    if "update_profile" in action:
        return _with_fields("Updated profile", details.get("changes"))

    # --- Comment Actions ---
    # Comments use "post_title" rather than "title" so they don't get swept
    # into the post-specific branch above. Readers must register to comment
    # on the public blog, so most comment.create rows are ordinary readers,
    # not workspace team members — call that out when it's a team member,
    # since that's the more notable case in a workspace's own activity log.
    if log.resource_type == "comment":
        post_title = details.get("post_title")
        on_post = f' on "{post_title}"' if post_title else (f" on post #{details['post_id']}" if details.get("post_id") else "")

        if action in ("comment.create", "comment.created"):
            role = details.get("commenter_role")
            if role and role != "reader":
                return f"Commented{on_post} (as {_role_label(role)})"
            return f"A reader commented{on_post}"

        if action in ("comment.update", "comment.updated"):
            return f"Edited a comment{on_post}"

        if action in ("comment.delete", "comment.deleted", "comment.moderator_delete"):
            deleted_by = details.get("deleted_by")
            if action == "comment.moderator_delete" or deleted_by == "moderator":
                return f"Removed a comment{on_post} (moderator)"
            return f"Deleted a comment{on_post}"

    # --- Tag Actions ---
    if "tag.created" in action or "tag.create" in action:
        name = details.get("name")
        return f'Created tag "{name}"' if name else "Created a tag"

    if "tag.deleted" in action:
        name = details.get("name")
        return f'Deleted tag "{name}"' if name else "Deleted a tag"

    # --- Generic before/after shapes, for any action not covered above ---
    # Simple toggle: {"from": ..., "to": ...}
    if "from" in details and "to" in details:
        return f"{action.replace('.', ' ')}: {details['from']} \u2192 {details['to']}"

    # Multi-field diff: {"changes": {field: {"from", "to"}}}
    changes = details.get("changes")
    if changes:
        return _with_fields(action.replace(".", " ").capitalize(), changes)

    fields = details.get("fields")
    if fields:
        return f"{action.replace('.', ' ')}: {', '.join(fields)}"

    # --- Fallback Formatting ---
    clean_action = action.replace("blog.", "").replace("_", " ").replace(".", " ")
    return clean_action.capitalize()


def _visible_logs(blog_id: int, current_user, session: Session):
    """
    The workspace's log rows this user may see: owners and editors only, no
    raw http.* middleware rows, and only as far back as the plan allows.
    Returns the base statement and the history window in days (None when
    unlimited).
    """
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

    role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
    if role not in [BlogRole.OWNER, BlogRole.EDITOR]:
        raise AuthorizationError(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only a workspace owner or editor can view activity logs.",
        )

    statement = select(AuditLog).where(
        AuditLog.blog_id == blog_id,
        ~AuditLog.action.startswith("http."),
    )

    # How far back a workspace can see depends on its plan. Older rows are
    # kept, so upgrading brings them back into view.
    history_days = None
    if not Permissions.is_super_admin(current_user):
        history_days = get_blog_limits(session, blog_id).activity_log_days
        statement = statement.where(AuditLog.created_at >= utc_now() - timedelta(days=history_days))

    return statement, history_days


@router.get("", response_model=List[AuditLogRead])
def get_workspace_audit_logs(
    blog_id: int,
    params: AuditLogQueryParams = Depends(),
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Workspace audit log, scoped to a single blog.
    Accessible by blog owners and editors only.
    """
    statement, _ = _visible_logs(blog_id, current_user, session)

    if params.action:
        statement = statement.where(AuditLog.action == params.action)
    if params.resource_type:
        statement = statement.where(AuditLog.resource_type == params.resource_type)
    if params.actor_user_id:
        statement = statement.where(AuditLog.actor_user_id == params.actor_user_id)
    if params.since:
        statement = statement.where(AuditLog.created_at >= params.since)
    if params.until:
        statement = statement.where(AuditLog.created_at < params.until)
    if params.search:
        # Applied at the DB level, before offset/limit, so "page 2 of N" stays
        # accurate while searching instead of only filtering whatever page
        # happened to already be loaded client-side.
        # Note: this searches the raw action name, actor email, and the raw
        # JSON `details` blob — not the human-readable `description`, which
        # is only computed at read time in _to_audit_log_read(). It'll catch
        # most useful terms (emails, role names, field names) but won't match
        # phrasing that only exists in the rendered sentence (e.g. arrows,
        # "Changed X's role").
        term = f"%{params.search}%"
        statement = statement.where(
            or_(
                AuditLog.actor_email.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.details.ilike(term),
            )
        )

    statement = statement.order_by(AuditLog.created_at.desc()).offset(params.skip).limit(params.limit)

    logs = session.exec(statement).all()

    actor_ids = {log.actor_user_id for log in logs if log.actor_user_id}
    names = (
        {user.id: _display_name(user) for user in session.exec(select(User).where(User.id.in_(actor_ids))).all()}
        if actor_ids
        else {}
    )
    return [_to_audit_log_read(log, names.get(log.actor_user_id)) for log in logs]


@router.get("/filters", response_model=AuditLogFilters)
def get_workspace_audit_log_filters(
    blog_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Everyone who appears in the visible history, most recently active first,
    for the activity log's "who" filter — including people who have since
    left the workspace, which the members list wouldn't have, and readers
    who commented. Also how far back the history goes on the plan.
    """
    base, history_days = _visible_logs(blog_id, current_user, session)
    visible = base.where(AuditLog.actor_user_id.is_not(None)).subquery()

    rows = session.exec(
        select(visible.c.actor_user_id, func.max(visible.c.actor_email))
        .group_by(visible.c.actor_user_id)
        .order_by(func.max(visible.c.created_at).desc())
        .limit(100)
    ).all()

    users = {
        user.id: user
        for user in session.exec(select(User).where(User.id.in_([row[0] for row in rows]))).all()
    } if rows else {}

    return AuditLogFilters(
        history_days=history_days,
        actors=[
            AuditLogActor(
                user_id=user_id,
                email=users[user_id].email if user_id in users else email,
                name=_display_name(users.get(user_id)),
            )
            for user_id, email in rows
        ],
    )
