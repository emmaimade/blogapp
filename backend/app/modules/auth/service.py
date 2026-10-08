import secrets

from fastapi import Response
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    create_access_token,
    verify_password,
)
from app.core.plans import get_effective_plan
from app.models import BlogMember, BlogRole, BlogSubscription, User
from app.schemas import UserRead
from app.services.auth_tokens import create_refresh_token


# A bcrypt hash of an unguessable constant, verified against when no user
# matches the identifier — keeps the "no such user" path taking roughly the
# same time as "wrong password" instead of returning early, which would
# otherwise be a timing side-channel for username enumeration.
_DUMMY_HASH = "$2b$12$/wa3BQRjE74Idw9F8WfC9e2kC55XUTof0OmUoYNMIBh1d8x5cl0bO"


def authenticate_user(identifier: str, password: str, session: Session) -> User | None:
    user = session.exec(select(User).where(or_(User.username == identifier, User.email == identifier))).first()
    if not user:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active or user.deleted_at is not None:
        return None
    return user

def build_user_payload(user_id: int, session: Session) -> UserRead:
    statement = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.blog_memberships).selectinload(BlogMember.blog))
    )
    hydrated_user = session.exec(statement).first()
    if not hydrated_user:
        raise ValueError(f"User with id={user_id} could not be loaded")
    payload = UserRead.model_validate(hydrated_user)

    owned_blog_ids = [m.blog_id for m in payload.blog_memberships if m.role == BlogRole.OWNER]
    if owned_blog_ids:
        subscriptions = {
            sub.blog_id: sub
            for sub in session.exec(select(BlogSubscription).where(BlogSubscription.blog_id.in_(owned_blog_ids))).all()
        }
        for membership in payload.blog_memberships:
            if membership.role == BlogRole.OWNER:
                membership.plan = get_effective_plan(subscriptions.get(membership.blog_id))
    return payload


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Issues the session as httpOnly cookies rather than handing the raw tokens
    to JS. Host-only (no explicit Domain) and relies on the frontends' Vercel
    rewrite proxying same-origin `/api/*` calls to this backend — that's what
    makes these ordinary first-party cookies instead of needing SameSite=None.

    csrf_token is deliberately NOT httpOnly: the frontend reads it and echoes
    it back as X-CSRF-Token on state-changing requests (see the CSRF check),
    which a cross-site page can't do since it can't read another origin's
    cookies — that's what defeats CSRF now that auth rides on a cookie the
    browser attaches automatically.
    """
    response.set_cookie(
        ACCESS_TOKEN_COOKIE_NAME,
        access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/auth",
    )
    response.set_cookie(
        CSRF_COOKIE_NAME,
        secrets.token_urlsafe(32),
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE_NAME, path="/auth")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")


def build_login_response(user: User, session: Session, response: Response) -> dict:
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(session, user.id)
    set_auth_cookies(response, access_token, refresh_token)
    user_payload = build_user_payload(user.id, session)
    return {
        "message": "Login successful",
        "user": user_payload.model_dump(mode="json"),
    }
