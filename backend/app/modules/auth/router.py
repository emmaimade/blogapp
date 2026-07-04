import hashlib
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.security import get_current_user, get_password_hash
from app.models import User, Blog
from app.models.auth_tokens import EmailVerification, PasswordResetToken
from app.services.auth_tokens import create_verification_token, create_password_reset_token
from app.core.email import dispatch_email
from app.core.email_templates import get_verification_template, get_password_reset_template
from app.schemas import UserRead

from .service import authenticate_user, build_login_response, build_user_payload

router = APIRouter(prefix="/auth", tags=["Auth"])

# Pydantic Schemas for handling incoming requests cleanly
class ResendVerificationSchema(BaseModel):
    email: EmailStr

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str


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



@router.get("/verify-email")
def verify_email(token: str = Query(...), session: Session = Depends(get_session)):
    """Validates the incoming token hash and updates the user's verification status."""
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()
    
    db_token = session.exec(
        select(EmailVerification).where(
            EmailVerification.token == hashed_token,
            EmailVerification.used_at == None
        )
    ).first()
    
    if not db_token or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired or is invalid."
        )
        
    user = session.get(User, db_token.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.email_verified = True
    db_token.used_at = datetime.now(timezone.utc)
    
    session.add(user)
    session.add(db_token)
    session.commit()
    
    return {"message": "Email verified successfully. You can now access your workspace."}


@router.post("/send-verification")
def send_verification_email(
    payload: ResendVerificationSchema, 
    background_tasks: BackgroundTasks, 
    session: Session = Depends(get_session)
):
    """Resends a verification token to unverified users."""
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        return {"message": "If the account exists, a verification link has been sent."}
        
    if user.email_verified:
        raise HTTPException(status_code=400, detail="This email is already verified.")
        
    raw_token = create_verification_token(session, user.id)
    email_content = get_verification_template(f"{user.first_name} {user.last_name}", raw_token)
    dispatch_email(background_tasks, user.email, "Verify your email address", email_content)
    
    return {"message": "If the account exists, a verification link has been sent."}


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordSchema, 
    background_tasks: BackgroundTasks, 
    session: Session = Depends(get_session)
):
    """Generates a secure recovery record and shoots an email link."""
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        return {"message": "If the email is registered, a password reset link has been sent."}
        
    raw_token = create_password_reset_token(session, user.id)
    email_content = get_password_reset_template(f"{user.first_name} {user.last_name}", raw_token)
    dispatch_email(background_tasks, user.email, "Reset your password", email_content)
    
    return {"message": "If the email is registered, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordSchema, session: Session = Depends(get_session)):
    """Verifies the reset token and updates user password credentials securely."""
    hashed_token = hashlib.sha256(payload.token.encode('utf-8')).hexdigest()
    
    db_token = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.token == hashed_token,
            PasswordResetToken.used_at == None
        )
    ).first()
    
    if not db_token or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link is invalid or has expired."
        )
        
    user = session.get(User, db_token.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Server-side password policy enforcement (minimum strength)
    new_password = payload.new_password or ""
    if len(new_password) < 8 or not any(c.isalpha() for c in new_password) or not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include both letters and numbers.",
        )

    user.hashed_password = get_password_hash(new_password)
    db_token.used_at = datetime.now(timezone.utc)
    
    session.add(user)
    session.add(db_token)
    session.commit()
    
    return {"message": "Password updated successfully. You can now log in."}