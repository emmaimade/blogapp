from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.security import create_access_token, verify_password
from app.models import BlogMember, User
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
    return UserRead.model_validate(hydrated_user)


def build_login_response(user: User, session: Session) -> dict:
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(session, user.id)
    user_payload = build_user_payload(user.id, session)
    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_payload.model_dump(mode="json"),
    }
