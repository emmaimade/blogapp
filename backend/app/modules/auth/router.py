from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.security import get_current_user
from app.models import User, Blog
from app.schemas import UserRead

from .service import authenticate_user, build_login_response, build_user_payload

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    user.last_login = datetime.now(timezone.utc)
    session.add(user)

    add_audit_log(
        session,
        action="user.login",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    
    session.commit()
    return build_login_response(user, session)


@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return build_user_payload(current_user, session)

@router.get("/check-slug")
def check_slug_availability(slug: str, session: Session = Depends(get_session)):
    """
    Check if a workspace subdomain slug is available for registration.
    Returns {"available": true} if free, else {"available": false}.
    """
    if not slug:
        return {"available": False}
        
    # Query your database to see if the slug is already taken by a Blog/Workspace
    existing = session.exec(
        select(Blog).where((Blog.slug == slug) | (Blog.subdomain == slug))
    ).first()
    
    # If existing is None, it means the slug is available!
    return {"available": existing is None}