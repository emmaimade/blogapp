from fastapi import Request
from jose import JWTError, jwt
from sqlmodel import Session, select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import ALGORITHM, SECRET_KEY
from app.core.db import engine
from app.models import User

# Exempt (method, path) pairs — checked as exact matches.
# Anything NOT listed here is BLOCKED for accounts with must_change_password = True.
# This is intentionally fail-closed: forgetting to exempt a new PUBLIC read
# endpoint here will break it loudly (a visible bug report), rather than
# silently leaving a protected endpoint unprotected.
EXEMPT_EXACT = {
    ("POST", "/auth/login"),
    ("POST", "/auth/change-password"),
    ("GET", "/auth/me"),
    ("GET", "/users/me"),
    ("POST", "/users/register"),
    ("POST", "/auth/forgot-password"),
    ("POST", "/auth/reset-password"),
    ("POST", "/auth/send-verification"),
    ("GET", "/auth/verify-email"),
    ("GET", "/"),
}

# Path PREFIXES exempt regardless of method — used for genuinely public,
# unauthenticated content. Add new public-read routes here as the API grows.
EXEMPT_PREFIXES = (
    "/docs",
    "/openapi.json",
    "/redoc",
    "/support/",
)


def _is_exempt(method: str, path: str) -> bool:
    if (method, path) in EXEMPT_EXACT:
        return True
    return any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES)


class RequirePasswordChangeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return await call_next(request)

        if _is_exempt(request.method, request.url.path):
            return await call_next(request)

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
        except JWTError:
            # Invalid/expired token — let the real auth dependency reject it
            # with the proper 401, rather than this middleware masking it.
            return await call_next(request)

        if not username:
            return await call_next(request)

        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()

        if user and user.must_change_password:
            return JSONResponse(
                status_code=403,
                content={"detail": "You must set a new password before continuing."},
            )

        return await call_next(request)