import json
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select, or_

from app.core.audit_describe import describe_audit_log
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
        description=describe_audit_log(log, details),
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
