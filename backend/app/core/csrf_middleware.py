from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.error_codes import ErrorCode, spec_for
from app.core.error_handlers import build_error_payload
from app.core.security import CSRF_COOKIE_NAME

STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

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
            return await call_next(request)

        header_token = request.headers.get("x-csrf-token")
        if not header_token or header_token != cookie_token:
            return JSONResponse(
                status_code=spec_for(ErrorCode.CSRF_TOKEN_INVALID).status_code,
                content=build_error_payload(
                    code=ErrorCode.CSRF_TOKEN_INVALID,
                    message=spec_for(ErrorCode.CSRF_TOKEN_INVALID).message,
                    request_id=getattr(request.state, "request_id", None),
                ),
            )

        return await call_next(request)
