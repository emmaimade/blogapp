"""
Per-user rate limits for reader-generated content — comments and moderation
reports.

Counted straight from the rows themselves rather than an in-memory limiter:
the API runs as serverless functions with no shared memory or Redis, so a
process-local counter would reset on every cold start and never limit
anything. Each check is one indexed COUNT over a short window.
"""

from datetime import timedelta
from typing import Iterable, Tuple

from sqlmodel import Session, func, select

from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import ConflictError, RateLimitError
from app.models import Comment, ModerationReport

# (window, max rows in that window)
COMMENT_LIMITS: Tuple[Tuple[timedelta, int], ...] = (
    (timedelta(minutes=1), 5),
    (timedelta(days=1), 50),
)
REPORT_LIMITS: Tuple[Tuple[timedelta, int], ...] = (
    (timedelta(hours=1), 10),
)
DUPLICATE_COMMENT_WINDOW = timedelta(seconds=60)


def check_comment_allowed(session: Session, user_id: int, post_id: int, content: str) -> None:
    """Raises if the user is commenting too fast, or re-posting what they just posted."""
    _check_limits(
        session,
        Comment.created_at,
        Comment.user_id == user_id,
        COMMENT_LIMITS,
        "You're commenting too quickly. Please wait a moment and try again.",
    )

    duplicate = session.exec(
        select(Comment.id).where(
            Comment.user_id == user_id,
            Comment.post_id == post_id,
            Comment.content == content,
            Comment.created_at >= utc_now() - DUPLICATE_COMMENT_WINDOW,
        )
    ).first()
    if duplicate is not None:
        raise ConflictError(ErrorCode.DUPLICATE_COMMENT)


def check_report_allowed(session: Session, reporter_id: int) -> None:
    _check_limits(
        session,
        ModerationReport.created_at,
        ModerationReport.reporter_id == reporter_id,
        REPORT_LIMITS,
        "You've sent a lot of reports recently. Please try again later.",
    )


def _check_limits(
    session: Session,
    created_at_column,
    owner_filter,
    limits: Iterable[Tuple[timedelta, int]],
    message: str,
) -> None:
    now = utc_now()
    for window, max_rows in limits:
        window_start = now - window
        in_window = (owner_filter, created_at_column >= window_start)
        count = session.exec(select(func.count()).where(*in_window)).one()
        if count < max_rows:
            continue

        # Retry once the oldest row in the window ages out of it.
        oldest = session.exec(select(func.min(created_at_column)).where(*in_window)).one()
        elapsed = (now - as_utc(oldest)).total_seconds() if oldest else 0
        raise RateLimitError(
            ErrorCode.RATE_LIMITED,
            message,
            retry_after_seconds=max(1, int(window.total_seconds() - elapsed)),
        )
