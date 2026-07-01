"""
app/core/audit.py

Central audit logging helper used everywhere in the application.
Call add_audit_log() inside any router after a significant action,
before session.commit() so they're in the same transaction.

Usage:
    add_audit_log(
        session,
        action="post.published",
        resource_type="post",
        resource_id=post.id,
        blog_id=post.blog_id,
        actor=current_user,
        details={"title": post.title},
        request=request,   # optional — captures IP + user agent
    )

Action naming convention (dot-separated, past tense):
    <resource>.<event>
    post.published          post.unpublished        post.deleted
    post.created            post.updated
    comment.deleted         comment.restored        comment.flagged
    member.invited          member.removed          member.role_changed
    settings.updated        branding.updated        domain.updated
    blog.onboarding_completed
    superadmin.blog_status_update   superadmin.blog_delete
    superadmin.user_status_update   superadmin.platform_settings_update
"""
import json
from typing import Any, Optional

from fastapi import Request
from sqlmodel import Session

from app.models.audit import AuditLog


def add_audit_log(
    session: Session,
    action: str,
    resource_type: str,
    actor: Any = None,
    resource_id: Optional[int] = None,
    blog_id: Optional[int] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """
    Create an audit log entry and add it to the session.
    Does NOT commit — the caller is responsible for committing.

    Parameters
    ----------
    session       : Active SQLModel session
    action        : Dot-namespaced action string e.g. "post.published"
    resource_type : Type of affected resource e.g. "post", "blog", "user"
    actor         : User ORM object (optional — some system actions have no actor)
    resource_id   : PK of the affected resource (optional)
    blog_id       : Tenant scope — always set when inside a blog context
    details       : Arbitrary dict serialised to JSON in the log row
    request       : FastAPI Request object — used to extract IP and user-agent
    """
    actor_user_id: Optional[int] = None
    actor_email: Optional[str] = None

    if actor is not None:
        actor_user_id = getattr(actor, "id", None)
        actor_email = getattr(actor, "email", None)

    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    if request is not None:
        # Respect X-Forwarded-For from reverse proxies
        forwarded = request.headers.get("x-forwarded-for")
        ip_address = forwarded.split(",")[0].strip() if forwarded else request.client.host
        user_agent = request.headers.get("user-agent")

    log = AuditLog(
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        blog_id=blog_id,
        details=json.dumps(details) if details else None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(log)
    return log