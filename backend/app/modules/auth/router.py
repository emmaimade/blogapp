from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.security import get_current_user
from app.models import User
from app.schemas import UserRead

from .service import authenticate_user, build_login_response, build_user_payload

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

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
