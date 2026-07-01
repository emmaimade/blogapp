"""
Mixin for all Pydantic schemas that serialise datetime fields.
Ensures every datetime is serialised as a UTC ISO string with a Z suffix
so browsers always interpret it as UTC, never as local time.

"""
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, model_serializer


class UTCDatetimeMixin(BaseModel):
    """
    Serialises all datetime fields as UTC ISO strings with Z suffix.
    Mix this into any schema that contains datetime fields.
    """

    @model_serializer(mode="wrap")
    def _serialise_utc(self, handler: Any) -> dict:
        result = handler(self)
        for key, value in result.items():
            if isinstance(value, datetime):
                # Ensure timezone-aware
                if value.tzinfo is None:
                    value = value.replace(tzinfo=timezone.utc)
                else:
                    value = value.astimezone(timezone.utc)
                # Format with Z suffix — not +00:00 — for maximum
                # compatibility with JS Date() and date-fns parseISO()
                result[key] = value.strftime('%Y-%m-%dT%H:%M:%SZ')
        return result

    class Config:
        from_attributes = True