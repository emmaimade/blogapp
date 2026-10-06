from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.error_codes import ErrorCode, spec_for
from app.core.error_handlers import build_error_payload
from app.core.security import ACCESS_TOKEN_COOKIE_NAME, CSRF_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME

STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Cookies the browser attaches automatically that carry a session — the
# things a forged cross-site request would be riding on.
SESSION_COOKIE_NAMES = (ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME)

# No session cookie exists yet at these points, so there's nothing to
# double-submit against.
EXEMPT_EXACT = {
    ("POST", "/auth/login"),
    ("POST", "/auth/refresh"),
    ("POST", "/auth/forgot-password"),
    ("POST", "/auth/reset-password"),
    ("POST", "/auth/send-verification"),
    ("POST", "/users/login"),
    ("POST", "/users/register"),
}

# /invitations/{token}/register-and-accept takes a dynamic path segment, so
# it can't live in EXEMPT_EXACT above — same reasoning as the other entries
# there: it creates a brand-new account and doesn't read any session cookie,
# so there's nothing for CSRF to protect regardless of whose csrf_token
# cookie happens to be sitting in the browser from an earlier session.
EXEMPT_SUFFIXES = ("/register-and-accept",)


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Double-submit CSRF check. Now that auth rides on a cookie the browser
    attaches automatically (see auth/service.py's set_auth_cookies), a
    state-changing request needs proof that whoever made it can *read* that
    cookie too — a cross-site page can't, since it can't see another origin's
    cookies. The frontend echoes the non-httpOnly csrf_token cookie back as
    an X-CSRF-Token header; this middleware just checks the two match.

    Requests carrying their own `Authorization: Bearer` header are left
    alone — that header can't be forged cross-site the way an ambient cookie
    can, so there's nothing here for CSRF to protect regardless of whether a
    csrf_token cookie also happens to be present (curl, /docs, and any other
    header-authenticated client will always hit this branch).
    """

    async def dispatch(self, request: Request, call_next):
        if request.method not in STATE_CHANGING_METHODS:
            return await call_next(request)
        if (request.method, request.url.path) in EXEMPT_EXACT:
            return await call_next(request)
        if request.method == "POST" and request.url.path.endswith(EXEMPT_SUFFIXES):
            return await call_next(request)
        if request.headers.get("authorization", "").lower().startswith("bearer "):
            return await call_next(request)

        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        if not cookie_token:
            # No session cookie either → nothing ambient to ride on, so
            # nothing to protect (anonymous requests, cookie-less logout).
            # But a session cookie *without* its csrf_token partner can't be
            # waved through: the csrf cookie is always issued alongside the
            # session cookies, so its absence means it was stripped or
            # never set, and skipping the check would let a cross-site
            # request act on the session unverified.
            if not _has_session_cookie(request):
                return await call_next(request)
            return _csrf_rejection(request)

        header_token = request.headers.get("x-csrf-token")
        if not header_token or header_token != cookie_token:
            return _csrf_rejection(request)

        return await call_next(request)


def _has_session_cookie(request: Request) -> bool:
    return any(request.cookies.get(name) for name in SESSION_COOKIE_NAMES)


def _csrf_rejection(request: Request) -> JSONResponse:
    spec = spec_for(ErrorCode.CSRF_TOKEN_INVALID)
    return JSONResponse(
        status_code=spec.status_code,
        content=build_error_payload(
            code=ErrorCode.CSRF_TOKEN_INVALID,
            message=spec.message,
            request_id=getattr(request.state, "request_id", None),
        ),
    )
