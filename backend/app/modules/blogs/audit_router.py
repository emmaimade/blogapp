"""
Workspace-level audit log endpoint.
Accessible by blog owners and editors, scoped strictly to their own blog.
Lives at: GET /blogs/{blog_id}/audit-logs
"""
import json
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

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


def _describe(log: AuditLog, details: dict[str, Any]) -> str:
    subject = log.resource_type.replace("_", " ")
    if log.resource_id:
        subject = f"{subject} #{log.resource_id}"
    fields = details.get("fields")
    if fields:
        return f"{log.action.replace('.', ' ')} on {subject}: {', '.join(fields)}"
    return f"{log.action.replace('.', ' ')} on {subject}"


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

    statement = select(AuditLog).where(AuditLog.blog_id == blog_id)

    if params.action:
        statement = statement.where(AuditLog.action == params.action)
    if params.resource_type:
        statement = statement.where(AuditLog.resource_type == params.resource_type)
    if params.actor_user_id:
        statement = statement.where(AuditLog.actor_user_id == params.actor_user_id)

    statement = statement.order_by(AuditLog.created_at.desc()).offset(params.skip).limit(params.limit)

    logs = session.exec(statement).all()
    return [_to_audit_log_read(log) for log in logs]
