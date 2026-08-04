import json
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, or_

from app.core.db import get_session
from app.core.permissions import Permissions
from app.core.security import get_current_user
from app.models import AuditLog, Blog
from app.models.blog import BlogRole
from app.schemas import AuditLogQueryParams, AuditLogRead

router = APIRouter(prefix="/blogs/{blog_id}/audit-logs", tags=["Audit Log"])


def _to_audit_log_read(log: AuditLog) -> AuditLogRead:
    try:
        details = json.loads(log.details) if log.details else {}
    except (TypeError, json.JSONDecodeError):
        details = {}

    return AuditLogRead(
        id=log.id,
        actor_user_id=log.actor_user_id,
        actor_email=log.actor_email,
        actor=log.actor_email,
        action=log.action,
        resource_type=log.resource_type,
        target_type=log.resource_type,
        resource_id=log.resource_id,
        blog_id=log.blog_id,
        details=details,
        description=_describe(log, details),
        ip_address=log.ip_address,
        user_agent=log.user_agent,
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
    if "settings.updated" in action or "branding.updated" in action:
        label = "branding / logo" if "branding" in action else "workspace settings"
        changes = details.get("changes")
        if changes:
            parts = [f"{field} {c.get('from')} \u2192 {c.get('to')}" for field, c in changes.items()]
            return f"Updated {label}: {'; '.join(parts)}"
        return f"Updated {label}"

    if "blog.update" in action or "blog_update" in action:
        changes = details.get("changes")
        if changes:
            parts = [f"{field} {c.get('from')} \u2192 {c.get('to')}" for field, c in changes.items()]
            return f"Updated workspace: {'; '.join(parts)}"
        return "Updated workspace details"

    if "update_profile" in action:
        changes = details.get("changes")
        if changes:
            parts = [f"{field.replace('_', ' ')} {c.get('from')} \u2192 {c.get('to')}" for field, c in changes.items()]
            return f"Updated profile: {'; '.join(parts)}"
        return "Updated profile details"

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
        parts = [f"{field} {c.get('from')} \u2192 {c.get('to')}" for field, c in changes.items()]
        return f"{action.replace('.', ' ')}: {'; '.join(parts)}"

    fields = details.get("fields")
    if fields:
        return f"{action.replace('.', ' ')}: {', '.join(fields)}"

    # --- Fallback Formatting ---
    clean_action = action.replace("blog.", "").replace("_", " ").replace(".", " ")
    return clean_action.capitalize()


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
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")

    role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
    if role not in [BlogRole.OWNER, BlogRole.EDITOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Must be blog owner or editor to view activity logs",
        )

    statement = select(AuditLog).where(
        AuditLog.blog_id == blog_id,
        ~AuditLog.action.startswith("http."),
    )

    if params.action:
        statement = statement.where(AuditLog.action == params.action)
    if params.resource_type:
        statement = statement.where(AuditLog.resource_type == params.resource_type)
    if params.actor_user_id:
        statement = statement.where(AuditLog.actor_user_id == params.actor_user_id)
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
    return [_to_audit_log_read(log) for log in logs]