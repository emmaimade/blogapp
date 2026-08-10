"""
Per-request correlation ID
==========================

Assigns every request an ID, exposes it three ways:

- `request.state.request_id` — for exception handlers
- a contextvar — for log records emitted deep in service code
- the `X-Request-ID` response header — for the browser/network tab

A client-supplied `X-Request-ID` is honoured so a trace can span the frontend
and backend, but it is length-capped and stripped of anything that isn't safe
in a log line — it ends up in log output, so it is untrusted input.
"""

import re
import uuid
from contextvars import ContextVar
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

REQUEST_ID_HEADER = "X-Request-ID"
_MAX_CLIENT_REQUEST_ID_LENGTH = 64
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_.-]+$")

_request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """The current request's ID, or None outside a request (scheduler, CLI)."""
    return _request_id_ctx.get()


def _resolve_request_id(request: Request) -> str:
    supplied = request.headers.get(REQUEST_ID_HEADER, "").strip()
    if (
        supplied
        and len(supplied) <= _MAX_CLIENT_REQUEST_ID_LENGTH
        and _SAFE_REQUEST_ID.match(supplied)
    ):
        return supplied
    return uuid.uuid4().hex


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Establishes the request ID, and acts as the outermost application-level
    catch for anything that escapes the route handlers.

    That catch matters for more than tidiness: Starlette's own
    `ServerErrorMiddleware` sits *outside* `CORSMiddleware`, so a 500 it
    produces reaches the browser without CORS headers and the frontend can only
    report "network error". Handling it here — inside CORS — means clients can
    actually read the error body.

    It delegates to the same handler the app registers for `Exception`, so
    there is exactly one place that decides what an unexpected failure looks
    like.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = _resolve_request_id(request)
        request.state.request_id = request_id
        token = _request_id_ctx.set(request_id)
        try:
            try:
                response = await call_next(request)
            except Exception as exc:  # noqa: BLE001 - deliberate catch-all
                # Imported here to avoid a circular import at module load:
                # error_handlers imports this module for get_request_id().
                from app.core.error_handlers import unhandled_exception_handler

                response = await unhandled_exception_handler(request, exc)
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            _request_id_ctx.reset(token)
