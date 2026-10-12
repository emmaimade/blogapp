"""
Endpoints for scheduled jobs.

On Vercel the API is serverless, so the in-process APScheduler can't be relied
on to fire; Vercel Cron calls these instead (see vercel.json). Vercel sends
`Authorization: Bearer $CRON_SECRET`; without CRON_SECRET configured the
endpoints don't exist.
"""

import hmac

from fastapi import APIRouter, Header

from app.core.config import settings
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.tasks import purge_expired_soft_deleted_users

router = APIRouter(prefix="/internal/cron", tags=["cron"], include_in_schema=False)


def _require_cron_secret(authorization: str | None) -> None:
    if not settings.CRON_SECRET:
        raise NotFoundError()
    if not hmac.compare_digest(authorization or "", f"Bearer {settings.CRON_SECRET}"):
        raise AuthenticationError(ErrorCode.AUTHENTICATION_REQUIRED)


@router.get("/purge-deleted-accounts")
def purge_deleted_accounts(authorization: str | None = Header(default=None)) -> dict[str, int]:
    _require_cron_secret(authorization)
    return purge_expired_soft_deleted_users()
