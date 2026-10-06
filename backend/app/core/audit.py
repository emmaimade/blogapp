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
from sqlalchemy import event
from sqlmodel import Session, select

from app.models.audit import AuditLog


def get_client_ip(request: Request) -> Optional[str]:
    """Client IP, preferring X-Forwarded-For (set by reverse proxies) over the raw socket peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def resolve_primary_blog_id(session: Session, user: Any) -> Optional[int]:
    """
    Best-effort tenant scope for account-level actions (login, profile edits,
    password changes) that happen outside any specific blog context — there's
    no blog_id to pass because the action itself isn't scoped to one blog.

    Only meaningful when the actor IS the resource (self-service actions).
    For an admin acting on a *different* user, this would resolve the
    admin's own blog, not the target's, so don't use it there.

    Prefers a blog the user owns; falls back to their first membership;
    None if they have neither (e.g. a superadmin-only account).
    """
    from app.models import Blog, BlogMember

    user_id = getattr(user, "id", None)
    if user_id is None:
        return None

    owned = session.exec(
        select(Blog.id).where(Blog.owner_id == user_id).order_by(Blog.id)
    ).first()
    if owned is not None:
        return owned

    return session.exec(
        select(BlogMember.blog_id).where(BlogMember.user_id == user_id).order_by(BlogMember.id)
    ).first()


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
        ip_address = get_client_ip(request)
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

    if request is not None:
        # Lets AuditLogMiddleware know a specific, correctly-scoped log was
        # already written for this request, so it skips its generic fallback.
        # Deferred to after_commit: if the caller's transaction never commits
        # (e.g. a later step in the same request raises before session.commit()),
        # this log is rolled back along with it — flipping the flag eagerly here
        # would have suppressed the middleware's fallback too, losing the audit
        # trail for the request entirely.
        def _mark_logged(_session: Session) -> None:
            request.state.audit_logged = True

        event.listen(session, "after_commit", _mark_logged, once=True)

    return log