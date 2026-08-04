import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from app.models.auth_tokens import EmailVerification, PasswordResetToken

TOKEN_EXPIRATION_HOURS = 24
TOKEN_COOLDOWN_SECONDS = 60


class TokenCooldownError(Exception):
    """Raised when a new token is requested too soon after a previous one for the same user."""
    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Please wait {retry_after_seconds}s before requesting another email.")


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
        elapsed = (datetime.now(timezone.utc) - most_recent.created_at).total_seconds()
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