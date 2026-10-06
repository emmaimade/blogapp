from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session, select

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthenticationError, AuthorizationError, BadRequestError
from app.models import User, PlatformRole

# Sent on every 401 so clients see a well-formed challenge, per RFC 6750.
_BEARER_CHALLENGE = {"WWW-Authenticate": "Bearer"}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

# Cookie names shared between the routes that set them (auth/service.py's
# build_login_response) and the code that reads them (this module, the
# password-change and audit middlewares).
ACCESS_TOKEN_COOKIE_NAME = "access_token"
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
CSRF_COOKIE_NAME = "csrf_token"


def extract_bearer_token(request: Request) -> Optional[str]:
    """
    The JWT for this request: the `Authorization: Bearer` header if present
    (curl, /docs, any non-browser API client), otherwise the httpOnly
    access-token cookie the browser frontends rely on.

    Used directly by the two raw ASGI middlewares (password-change gate,
    audit log) that can't use FastAPI's dependency injection; get_current_user
    below reaches the same result through oauth2_scheme_optional instead, to
    keep the OpenAPI "Authorize" declaration for /docs.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)


PASSWORD_MIN_LENGTH = 8
PASSWORD_RULE_MESSAGE = (
    "Use at least 8 characters, including both letters and numbers."
)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def is_strong_password(password: Optional[str]) -> bool:
    """The platform's minimum password policy: 8+ chars, letters and digits."""
    candidate = password or ""
    return (
        len(candidate) >= PASSWORD_MIN_LENGTH
        and any(c.isalpha() for c in candidate)
        and any(c.isdigit() for c in candidate)
    )


def ensure_strong_password(password: Optional[str], field: str = "password") -> None:
    """
    Raise a field-attributed validation error if `password` is too weak.

    Single source of truth for the policy — it was previously reimplemented at
    three separate raise sites (password reset, password change, and invite
    signup), and the invite path had already drifted to a weaker length-only
    check returning a different status code.
    """
    if not is_strong_password(password):
        raise BadRequestError(
            ErrorCode.WEAK_PASSWORD,
            errors={field: PASSWORD_RULE_MESSAGE},
        )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme_optional),
    session: Session = Depends(get_session),
):
    # Header first (curl, /docs, any non-browser API client), falling back to
    # the httpOnly access-token cookie the browser frontends rely on.
    token = token or request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        raise AuthenticationError(ErrorCode.AUTHENTICATION_REQUIRED, headers=_BEARER_CHALLENGE)

    # An expired token is worth telling apart from a malformed one: "your
    # session has expired, log in again" is actionable, "invalid token" isn't.
    # Both stay 401 so client-side session handling is unaffected.
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise AuthenticationError(ErrorCode.SESSION_EXPIRED, headers=_BEARER_CHALLENGE)
    except JWTError as exc:
        raise AuthenticationError(
            ErrorCode.AUTHENTICATION_REQUIRED,
            headers=_BEARER_CHALLENGE,
            log_message=f"token rejected: {type(exc).__name__}",
        )

    username: str = payload.get("sub")
    if username is None:
        raise AuthenticationError(
            ErrorCode.AUTHENTICATION_REQUIRED,
            headers=_BEARER_CHALLENGE,
            log_message="token payload has no subject claim",
        )

    user = session.exec(select(User).where(User.username == username)).first()
    # Deliberately one response for "no such user", "suspended", and "deleted" —
    # a token holder shouldn't be able to probe account state from the outside.
    if user is None or not user.is_active or user.deleted_at is not None:
        raise AuthenticationError(
            ErrorCode.AUTHENTICATION_REQUIRED,
            headers=_BEARER_CHALLENGE,
            log_message="token subject is unknown, inactive, or deleted",
        )
    return user

def require_verified_email(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.email_verified:
        raise AuthorizationError(ErrorCode.EMAIL_NOT_VERIFIED)
    return current_user


def require_password_changed(current_user: User = Depends(get_current_user)) -> User:
    if current_user.must_change_password:
        raise AuthorizationError(ErrorCode.PASSWORD_CHANGE_REQUIRED)
    return current_user


async def get_current_user_optional(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme_optional),
    session: Session = Depends(get_session),
) -> Optional[User]:
    token = token or request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = session.exec(select(User).where(User.username == username)).first()
        if user is None or not user.is_active or user.deleted_at is not None:
            return None
        return user
    except (JWTError, AttributeError):
        return None


def admin_only(current_user: User = Depends(get_current_user)):
    if not current_user.is_super_admin and current_user.platform_role != PlatformRole.SUPER_ADMIN:
        raise AuthorizationError(ErrorCode.SUPER_ADMIN_REQUIRED)
    return current_user
