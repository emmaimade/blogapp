from datetime import timedelta
from typing import Optional

from sqlmodel import Session, func, select

from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import RateLimitError
from app.models.auth_tokens import LoginAttempt

WINDOW_MINUTES = 15
MAX_ATTEMPTS_PER_ACCOUNT = 5
MAX_ATTEMPTS_PER_IP = 20


class LoginThrottledError(RateLimitError):
    """Raised when either the account or the source IP has too many recent failed logins."""

    def __init__(self, retry_after_seconds: int):
        super().__init__(
            ErrorCode.RATE_LIMITED,
            "Too many failed login attempts. Please try again later.",
            retry_after_seconds=retry_after_seconds,
        )


def _oldest_within_window(db: Session, column, value) -> Optional[object]:
    window_start = utc_now() - timedelta(minutes=WINDOW_MINUTES)
    return db.exec(
        select(LoginAttempt)
        .where(column == value, LoginAttempt.created_at >= window_start)
        .order_by(LoginAttempt.created_at.asc())
    ).first()


def _count_within_window(db: Session, column, value) -> int:
    window_start = utc_now() - timedelta(minutes=WINDOW_MINUTES)
    return db.exec(
        select(func.count()).select_from(LoginAttempt).where(
            column == value, LoginAttempt.created_at >= window_start
        )
    ).one()


def check_login_allowed(db: Session, identifier: str, ip_address: Optional[str]) -> None:
    """Raises LoginThrottledError if the account or the source IP is over its failed-attempt threshold."""
    normalized = identifier.strip().lower()

    account_count = _count_within_window(db, LoginAttempt.identifier, normalized)
    if account_count >= MAX_ATTEMPTS_PER_ACCOUNT:
        oldest = _oldest_within_window(db, LoginAttempt.identifier, normalized)
        raise LoginThrottledError(retry_after_seconds=_retry_after(oldest))

    if ip_address:
        ip_count = _count_within_window(db, LoginAttempt.ip_address, ip_address)
        if ip_count >= MAX_ATTEMPTS_PER_IP:
            oldest = _oldest_within_window(db, LoginAttempt.ip_address, ip_address)
            raise LoginThrottledError(retry_after_seconds=_retry_after(oldest))


def _retry_after(oldest: Optional[LoginAttempt]) -> int:
    if oldest is None:
        return WINDOW_MINUTES * 60
    elapsed = (utc_now() - as_utc(oldest.created_at)).total_seconds()
    return max(1, int(WINDOW_MINUTES * 60 - elapsed))


def record_failed_login(db: Session, identifier: str, ip_address: Optional[str]) -> None:
    db.add(LoginAttempt(identifier=identifier.strip().lower(), ip_address=ip_address))
    db.commit()
