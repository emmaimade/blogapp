import json
from typing import Any, Optional

from sqlmodel import Session

from app.models import AuditLog, User


def add_audit_log(
    session: Session,
    *,
    action: str,
    resource_type: str,
    actor: Optional[User] = None,
    resource_id: Optional[int] = None,
    blog_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        actor_user_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        blog_id=blog_id,
        details=json.dumps(details or {}),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(log)
    return log
