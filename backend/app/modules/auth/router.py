import hashlib
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.core.audit import add_audit_log
from app.core.datetimes import as_utc, utc_now
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import (
    AuthenticationError,
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.core.security import (
    ensure_strong_password,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models import User, Blog
from app.models.auth_tokens import EmailVerification, PasswordResetToken
from app.services.auth_tokens import create_verification_token, create_password_reset_token
from app.core.email import dispatch_email
from app.core.email_templates import (
    get_verification_template,
    get_verification_template_text,
    get_password_reset_template,
    get_password_reset_template_text,
    get_email_verified_template,
    get_email_verified_template_text,
    get_password_changed_template,
    get_password_changed_template_text,
)
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

class ChangePasswordSchema(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        # Same response whether the address is unknown or the password is
        # wrong, so login can't be used to enumerate accounts. Kept at 400
        # rather than 401: the admin client treats *any* 401 as an expired
        # session and hard-redirects to /admin/login, which would wipe the
        # inline "wrong password" message before the user could read it.
        raise AuthenticationError(ErrorCode.INVALID_CREDENTIALS)

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
    return build_user_payload(current_user.id, session)

@router.get("/check-slug")
def check_slug_availability(slug: str, session: Session = Depends(get_session)):
    """
    Check if a workspace subdomain slug is available for registration.
    Returns {"available": true} if free, else {"available": false}.
    """
    if not slug:
        return {"available": False}
        
    existing = session.exec(
        select(Blog).where((Blog.slug == slug) | (Blog.subdomain == slug))
    ).first()
    
    return {"available": existing is None}



@router.get("/verify-email")
def verify_email(
    background_tasks: BackgroundTasks,
    token: str = Query(...),
    session: Session = Depends(get_session),
):
    """Validates the incoming token hash and updates the user's verification status."""
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()

    db_token = session.exec(
        select(EmailVerification).where(EmailVerification.token == hashed_token)
    ).first()

    if not db_token:
        raise BadRequestError(ErrorCode.INVALID_TOKEN)

    user = session.get(User, db_token.user_id)
    if not user:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)

    # check if the token has already been used or if the user is already verified
    if db_token.used_at is not None or user.email_verified:
        return {
            "message": "Your email is already verified. You can continue to your workspace.",
            "already_verified": True,
        }

    # Check if the token has expired
    if as_utc(db_token.expires_at) < utc_now():
        raise BadRequestError(
            ErrorCode.INVALID_TOKEN,
            "This verification link has expired. Request a new one to continue.",
        )

    user.email_verified = True
    db_token.used_at = datetime.now(timezone.utc)
    session.add(user)
    session.add(db_token)

    add_audit_log(
        session,
        action="user.email_verified",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    session.commit()

    full_name = f"{user.first_name} {user.last_name}"
    email_html = get_email_verified_template(full_name)
    email_text = get_email_verified_template_text(full_name)
    dispatch_email(background_tasks, user.email, "Your email has been verified", email_html, email_text)

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
        raise ConflictError(ErrorCode.EMAIL_ALREADY_VERIFIED)
        
    raw_token = create_verification_token(session, user.id)
    full_name = f"{user.first_name} {user.last_name}"
    email_html = get_verification_template(full_name, raw_token)
    email_text = get_verification_template_text(full_name, raw_token)
    dispatch_email(background_tasks, user.email, "Verify your email address", email_html, email_text)

    add_audit_log(
        session,
        action="user.verification_email_requested",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    session.commit()

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
        
    # TokenCooldownError is an AppError, so it propagates straight to the
    # central handler as a 429 with Retry-After — no local conversion needed.
    raw_token = create_password_reset_token(session, user.id)

    full_name = f"{user.first_name} {user.last_name}"
    email_html = get_password_reset_template(full_name, raw_token)
    email_text = get_password_reset_template_text(full_name, raw_token)
    dispatch_email(background_tasks, user.email, "Reset your password", email_html, email_text)

    add_audit_log(
        session,
        action="user.forgot_password_requested",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    session.commit()
    
    return {"message": "If the email is registered, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordSchema,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Verifies the reset token and updates user password credentials securely."""
    hashed_token = hashlib.sha256(payload.token.encode('utf-8')).hexdigest()

    db_token = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.token == hashed_token,
            PasswordResetToken.used_at == None
        )
    ).first()

    if not db_token or as_utc(db_token.expires_at) < utc_now():
        raise BadRequestError(
            ErrorCode.INVALID_TOKEN,
            "This password reset link is invalid or has expired. Please request a new one.",
        )

    user = session.get(User, db_token.user_id)
    if not user:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)
    new_password = payload.new_password or ""
    ensure_strong_password(new_password, field="new_password")

    user.hashed_password = get_password_hash(new_password)
    db_token.used_at = datetime.now(timezone.utc)

    session.add(user)
    session.add(db_token)

    add_audit_log(
        session,
        action="user.password_reset_completed",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    session.commit()

    full_name = f"{user.first_name} {user.last_name}"
    email_html = get_password_changed_template(full_name)
    email_text = get_password_changed_template_text(full_name)
    dispatch_email(background_tasks, user.email, "Your password was changed", email_html, email_text)

    return {"message": "Password updated successfully. You can now log in."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordSchema,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Allows a logged-in user to change their own password, verifying their current one first."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise BadRequestError(
            ErrorCode.INCORRECT_PASSWORD,
            errors={"current_password": "This doesn't match your current password."},
        )

    new_password = payload.new_password or ""
    ensure_strong_password(new_password, field="new_password")

    if verify_password(new_password, current_user.hashed_password):
        raise BadRequestError(
            ErrorCode.INVALID_INPUT,
            "Your new password must be different from your current one.",
            errors={"new_password": "Choose a password you haven't used here before."},
        )

    current_user.hashed_password = get_password_hash(new_password)
    current_user.must_change_password = False
    session.add(current_user)

    add_audit_log(
        session,
        action="user.change_password",
        resource_type="user",
        resource_id=current_user.id,
        actor=current_user,
    )
    session.commit()

    full_name = f"{current_user.first_name} {current_user.last_name}"
    email_html = get_password_changed_template(full_name)
    email_text = get_password_changed_template_text(full_name)
    dispatch_email(background_tasks, current_user.email, "Your password was changed", email_html, email_text)

    return {"message": "Password updated successfully."}