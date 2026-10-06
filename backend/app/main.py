import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.audit_middleware import AuditLogMiddleware
from app.core.config import settings
from app.core.csrf_middleware import CSRFMiddleware
from app.core.db import create_db_and_tables
from app.core.error_handlers import register_exception_handlers
from app.core.exceptions import NotFoundError
from app.core.logging_config import configure_logging
from app.core.request_context import RequestContextMiddleware
from app.core.scheduler import start_scheduler, stop_scheduler
from app.core.password_change_middleware import RequirePasswordChangeMiddleware
from app.schemas.errors import ErrorResponse, ValidationErrorResponse
from app.modules import (
    auth_router,
    blog_comments_router,
    comments_router,
    contact_router,
    posts_router,
    settings_router,
    tags_router,
    users_router,
    blogs_router,
    blog_invitations_router,
    invitations_router,
    superadmin_router,
    audit_router,
    support_router,
    notifications_router,
)

# ── Lifespan — replaces deprecated @app.on_event ─────────────────────────────
# FastAPI recommends using lifespan context managers over on_event handlers.
# This runs startup logic before yield and shutdown logic after.
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    configure_logging()
    # create_db_and_tables()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="CMS Backend",
    version="0.1.0",
    lifespan=lifespan,
    # Documents the real error contract on every operation, replacing FastAPI's
    # default `{"detail": ...}` stub in the generated OpenAPI schema.
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        403: {"model": ErrorResponse, "description": "Not permitted"},
        404: {"model": ErrorResponse, "description": "Not found"},
        409: {"model": ErrorResponse, "description": "Conflict"},
        422: {"model": ValidationErrorResponse, "description": "Validation failed"},
        429: {"model": ErrorResponse, "description": "Rate limited"},
        500: {"model": ErrorResponse, "description": "Unexpected server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
    },
)

# ── Error handling ────────────────────────────────────────────────────────────
# Registered before the routers so every route is covered. See
# app/core/error_handlers.py for the response contract.
register_exception_handlers(app)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Driven by CORS_ORIGINS (comma-separated) so a new environment (e.g. a
# staging deploy) only needs an env var, not a code change. Defaults to the
# same production + local-dev set that used to be hardcoded here.
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

# Middleware is applied outermost-last, so the effective request order is:
#   CORS -> RequestContext -> AuditLog -> RequirePasswordChange -> CSRF -> routes
#
# RequestContextMiddleware sits *inside* CORS on purpose. It is what turns an
# unhandled exception into the standard error envelope, and a response produced
# outside CORSMiddleware reaches the browser without CORS headers — leaving the
# frontend unable to read anything but "network error".
app.add_middleware(CSRFMiddleware)
app.add_middleware(RequirePasswordChangeMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(tags_router)
app.include_router(users_router)
app.include_router(comments_router)
app.include_router(blog_comments_router)
app.include_router(contact_router)
app.include_router(settings_router)
app.include_router(blogs_router)
app.include_router(blog_invitations_router)
app.include_router(invitations_router)
app.include_router(superadmin_router)
app.include_router(audit_router)
app.include_router(support_router)
app.include_router(notifications_router)


@app.get("/")
def read_root():
    return {"status": "CMS Backend is running"}


# TEMPORARY — remove once the trusted client-IP header has been chosen.
# Shows which proxy headers reach the backend through Vercel (direct and via
# the frontends' /api rewrite). Off unless DEBUG_CLIENT_IP=1, and echoes only
# IP-related headers — never cookies or Authorization.
@app.get("/debug/client-ip", include_in_schema=False)
def debug_client_ip(request: Request):
    if os.getenv("DEBUG_CLIENT_IP") != "1":
        raise NotFoundError()
    keys = ["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for", "forwarded"]
    return {
        "socket_peer": request.client.host if request.client else None,
        **{key: request.headers.get(key) for key in keys},
    }