"""
Datetime normalisation helpers.

Timestamps are stored UTC-aware (`DateTime(timezone=True)`), but whether they
come *back* aware depends on the driver: Postgres preserves the offset, SQLite
has nowhere to keep it and returns naive values. Comparing a naive value from
the database against `datetime.now(timezone.utc)` raises

    TypeError: can't subtract offset-naive and offset-aware datetimes

which surfaces as an unexplained 500 on whatever endpoint touched it.

`as_utc` applies the same "naive means UTC" convention the schema layer already
uses when serialising (see `app.schemas.datetime_mixin.UTCDatetimeMixin`), so
comparisons are safe regardless of backend.
"""

from datetime import datetime, timezone
from typing import Optional


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Return `value` as a UTC-aware datetime, treating naive input as UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def utc_now() -> datetime:
    """Current time, UTC-aware."""
    return datetime.now(timezone.utc)
