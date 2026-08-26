import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import BadRequestError, GoneError, RateLimitError
from app.models.auth_tokens import EmailVerification, PasswordResetToken, RefreshToken
from app.models.user import User

TOKEN_EXPIRATION_HOURS = 24
TOKEN_COOLDOWN_SECONDS = 60


class TokenCooldownError(RateLimitError):
    """
    Raised when a new token is requested too soon after a previous one for the
    same user.

    An `AppError`, so the three routers that trigger it no longer each convert
    it to an `HTTPException` with their own wording — the central handler
    returns 429 with a `Retry-After` header. Callers that want to *ignore* the
    cooldown (registration, where a fresh account can't realistically be in
    one) still just catch it.
    """

    def __init__(self, retry_after_seconds: int):
        super().__init__(
            ErrorCode.RATE_LIMITED,
            f"We just sent you an email. Please wait {retry_after_seconds} seconds "
            "before requesting another.",
            retry_after_seconds=retry_after_seconds,
        )


def generate_secure_token() -> tuple[str, str]:
    """
    Generates a high-entropy cryptographically secure random token string.
    Returns a tuple of: (raw_token, sha256_hashed_token)
    """
    raw_token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    return raw_token, hashed_token


def _check_cooldown(db: Session, model, user_id: int) -> None:
    """Raises TokenCooldownError if a token for this user was created too recently."""
    most_recent = db.exec(
        select(model)
        .where(model.user_id == user_id)
        .order_by(model.created_at.desc())
    ).first()

    if most_recent:
        # as_utc, not a bare subtraction: whether created_at comes back aware
        # depends on the driver, and a naive value here raised a TypeError that
        # reached the client as an unexplained 500.
        elapsed = (utc_now() - as_utc(most_recent.created_at)).total_seconds()
        if elapsed < TOKEN_COOLDOWN_SECONDS:
            raise TokenCooldownError(retry_after_seconds=int(TOKEN_COOLDOWN_SECONDS - elapsed))


def create_verification_token(db: Session, user_id: int) -> str:
    """
    Generates an email verification token, purges any existing unused 
    verification records for this user, and commits the hashed variant.
    """
    _check_cooldown(db, EmailVerification, user_id)

    raw_token, hashed_token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRATION_HOURS)
    
    # Clean up any lingering active records for this user
    existing_tokens = db.exec(
        select(EmailVerification).where(
            EmailVerification.user_id == user_id, 
            EmailVerification.used_at == None
        )
    ).all()
    for token_record in existing_tokens:
        db.delete(token_record)
        
    db_token = EmailVerification(
        user_id=user_id,
        token=hashed_token,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    return raw_token

def create_password_reset_token(db: Session, user_id: int) -> str:
    """
    Generates a password recovery token, invalidates prior unexpired records
    for safety, and persists the cryptographically hashed string.
    """
    _check_cooldown(db, PasswordResetToken, user_id)

    raw_token, hashed_token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRATION_HOURS)
    
    # Clean up prior password recovery tokens
    existing_tokens = db.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at == None
        )
    ).all()
    for token_record in existing_tokens:
        db.delete(token_record)
        
    db_token = PasswordResetToken(
        user_id=user_id,
        token=hashed_token,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    return raw_token


def create_refresh_token(db: Session, user_id: int) -> str:
    """
    Unlike the verification/reset tokens above, refresh tokens have no
    cooldown (a legitimate client may refresh many times) and prior tokens
    for the user aren't purged here — rotation revokes them one at a time as
    they're actually used, via verify_and_rotate_refresh_token below.
    """
    raw_token, hashed_token = generate_secure_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(
        user_id=user_id,
        token=hashed_token,
        expires_at=expires_at,
    )
    db.add(db_token)
    db.commit()
    return raw_token


def verify_and_rotate_refresh_token(db: Session, raw_token: str) -> tuple[User, str]:
    """
    Validates a refresh token and rotates it: the presented token is revoked
    and a new one is issued in the same call. Reuse of an already-revoked
    token (a theft signal) is rejected the same as an unknown token.
    """
    hashed_token = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    record = db.exec(select(RefreshToken).where(RefreshToken.token == hashed_token)).first()

    if not record or record.revoked_at is not None:
        raise BadRequestError(ErrorCode.INVALID_TOKEN, "This session is no longer valid. Please log in again.")

    if as_utc(record.expires_at) < utc_now():
        raise GoneError(ErrorCode.LINK_EXPIRED, "Your session has expired. Please log in again.")

    # Deliberately one response for "no such user", "suspended", and
    # "deleted" — same reasoning as get_current_user in core/security.py.
    user = db.get(User, record.user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise BadRequestError(ErrorCode.INVALID_TOKEN, "This session is no longer valid. Please log in again.")

    record.revoked_at = datetime.now(timezone.utc)
    db.add(record)

    new_raw_token = create_refresh_token(db, record.user_id)
    return user, new_raw_token


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    """Logout — revokes the presented refresh token if it exists and isn't already revoked."""
    hashed_token = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    record = db.exec(select(RefreshToken).where(RefreshToken.token == hashed_token)).first()
    if record and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        db.add(record)
        db.commit()