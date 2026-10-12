import hashlib
import hmac
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

# The code in the verification email: short-lived, and a few wrong guesses
# kill it. The link in the same email keeps the 24-hour lifetime above.
VERIFICATION_CODE_LENGTH = 6
VERIFICATION_CODE_TTL_MINUTES = 15
VERIFICATION_CODE_MAX_ATTEMPTS = 5


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


def generate_verification_code() -> str:
    return f"{secrets.randbelow(10 ** VERIFICATION_CODE_LENGTH):0{VERIFICATION_CODE_LENGTH}d}"


def hash_verification_code(user_id: int, code: str) -> str:
    """
    HMAC rather than a bare SHA-256: a million possible codes would fall to a
    lookup table if the table leaked. Keying it with the user's id too means a
    code is only ever valid for the account it was sent to.
    """
    message = f"{user_id}:{code}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def create_verification_token(db: Session, user_id: int) -> tuple[str, str]:
    """
    Generates an email verification link token and a 6-digit code (one email
    carries both), purges any existing unused verification records for this
    user, and commits the hashed variants. Returns (raw_token, code).
    """
    _check_cooldown(db, EmailVerification, user_id)

    raw_token, hashed_token = generate_secure_token()
    code = generate_verification_code()
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
        code_hash=hash_verification_code(user_id, code),
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    return raw_token, code


def check_verification_code(db: Session, user_id: int, code: str) -> EmailVerification:
    """
    Returns the verification record if `code` matches the user's live code;
    otherwise raises, counting the wrong guess. After VERIFICATION_CODE_MAX_ATTEMPTS
    the code is dead and only a fresh one (behind the resend cooldown) will do —
    which caps guessing at a handful of tries a minute against a million codes.
    """
    record = db.exec(
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user_id,
            EmailVerification.used_at == None,  # noqa: E711
            EmailVerification.code_hash != None,  # noqa: E711
        )
        .order_by(EmailVerification.created_at.desc())
    ).first()

    if record is None:
        raise BadRequestError(
            ErrorCode.VERIFICATION_CODE_INVALID,
            "There's no code waiting for this account. Send a new one.",
        )
    if record.code_attempts >= VERIFICATION_CODE_MAX_ATTEMPTS:
        raise BadRequestError(ErrorCode.VERIFICATION_CODE_LOCKED)
    if utc_now() - as_utc(record.created_at) > timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES):
        raise BadRequestError(ErrorCode.VERIFICATION_CODE_EXPIRED)

    if not hmac.compare_digest(hash_verification_code(user_id, code), record.code_hash):
        record.code_attempts += 1
        db.add(record)
        db.commit()
        remaining = VERIFICATION_CODE_MAX_ATTEMPTS - record.code_attempts
        if remaining <= 0:
            raise BadRequestError(ErrorCode.VERIFICATION_CODE_LOCKED)
        tries = "1 try" if remaining == 1 else f"{remaining} tries"
        raise BadRequestError(
            ErrorCode.VERIFICATION_CODE_INVALID,
            f"That code isn't right. Check the email and try again ({tries} left).",
        )

    return record

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