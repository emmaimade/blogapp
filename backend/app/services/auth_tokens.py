import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from app.models.auth_tokens import EmailVerification, PasswordResetToken

TOKEN_EXPIRATION_HOURS = 24

def generate_secure_token() -> tuple[str, str]:
    """
    Generates a high-entropy cryptographically secure random token string.
    Returns a tuple of: (raw_token, sha256_hashed_token)
    """
    raw_token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    return raw_token, hashed_token

def create_verification_token(db: Session, user_id: int) -> str:
    """
    Generates an email verification token, purges any existing unused 
    verification records for this user, and commits the hashed variant.
    """
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