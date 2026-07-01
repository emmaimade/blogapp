from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.security import create_access_token, verify_password
from app.models import BlogMember, User
from app.schemas import UserRead


def authenticate_user(identifier: str, password: str, session: Session) -> User | None:
    user = session.exec(select(User).where(or_(User.username == identifier, User.email == identifier))).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    if not user.is_active or user.deleted_at is not None:
        return None
    return user

def build_user_payload(user: User, session: Session) -> UserRead:
    statement = (
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.blog_memberships).selectinload(BlogMember.blog))
    )
    hydrated_user = session.exec(statement).first()
    if not hydrated_user:
        raise ValueError(f"User with id={user.id} could not be loaded")
    return UserRead.model_validate(hydrated_user)

def build_login_response(user: User, session: Session) -> dict:
    access_token = create_access_token(data={"sub": user.username})
    user_payload = build_user_payload(user, session)
    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_payload.model_dump(mode="json"),
    }
