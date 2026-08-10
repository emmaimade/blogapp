"""
Centralised exception handlers
==============================

Every error response the API emits is built by `build_error_response` in this
module. Nothing else in the codebase constructs an error body.

Response shape
--------------

    {
      "success": false,
      "message": "The post you're looking for could not be found.",
      "code": "POST_NOT_FOUND",
      "request_id": "9f2c…",
      "detail": "The post you're looking for could not be found."
    }

`detail` duplicates `message`. It is not redundant by accident: the admin,
blog, and marketing frontends all read `err.response.data.detail` as a string
today, and FastAPI's own 422 responses put a *list of objects* there. Keeping
`detail` as a plain string makes this refactor backwards compatible everywhere
and simultaneously fixes the shape mismatch those clients were working around.
New client code should read `code` and `message`.

Validation failures add `errors`:

    "errors": {"title": "This field is required."}

The layering rule
-----------------

Internal detail (driver errors, tracebacks, constraint names, upstream API
responses) goes to the logger. The response only ever carries a message from
`ERROR_SPECS` or an explicitly written override. There is no branch in this
module that interpolates an exception into the body.
"""

from typing import Any, Mapping, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import (
    DBAPIError,
    IntegrityError,
    OperationalError,
    SQLAlchemyError,
)
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.error_codes import ErrorCode, code_for_status, spec_for
from app.core.exceptions import AppError
from app.core.logging_config import get_logger
from app.core.request_context import get_request_id

logger = get_logger("errors")


# ── Response construction ─────────────────────────────────────────────────────


def build_error_payload(
    *,
    code: ErrorCode,
    message: str,
    request_id: Optional[str] = None,
    errors: Optional[Mapping[str, str]] = None,
) -> dict[str, Any]:
    """The one and only error body builder."""
    payload: dict[str, Any] = {
        "success": False,
        "message": message,
        "code": code.value,
    }
    if errors:
        payload["errors"] = dict(errors)
    if request_id:
        payload["request_id"] = request_id
    # Backwards-compatible alias — see module docstring.
    payload["detail"] = message
    return payload


def build_error_response(
    request: Optional[Request],
    *,
    code: ErrorCode,
    message: Optional[str] = None,
    status_code: Optional[int] = None,
    errors: Optional[Mapping[str, str]] = None,
    headers: Optional[dict[str, str]] = None,
) -> JSONResponse:
    spec = spec_for(code)
    return JSONResponse(
        status_code=status_code or spec.status_code,
        content=build_error_payload(
            code=code,
            message=message or spec.message,
            request_id=_request_id(request),
            errors=errors,
        ),
        headers=headers,
    )


def _request_id(request: Optional[Request]) -> Optional[str]:
    if request is not None:
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            return request_id
    return get_request_id()


def _log_context(request: Optional[Request]) -> dict[str, Any]:
    """
    Identifiers that make a log line actionable without being sensitive.

    Deliberately excludes the request body and query string — those routinely
    carry passwords and tokens on this API (`/auth/reset-password`,
    `/auth/verify-email?token=…`).
    """
    if request is None:
        return {}
    context: dict[str, Any] = {
        "method": request.method,
        "path": request.url.path,
    }
    # Set by get_current_user-dependent routes only after auth resolves, so
    # this is best-effort.
    user = getattr(request.state, "user_id", None)
    if user is not None:
        context["user_id"] = user
    blog_id = (request.scope.get("path_params") or {}).get("blog_id")
    if blog_id is not None:
        context["blog_id"] = blog_id
    return context


def _context_suffix(request: Optional[Request], **extra: Any) -> str:
    context = {**_log_context(request), **{k: v for k, v in extra.items() if v is not None}}
    if not context:
        return ""
    return " | " + " ".join(f"{key}={value}" for key, value in context.items())


# ── Handlers ──────────────────────────────────────────────────────────────────


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """
    Expected business failures.

    Logged at WARNING (they're normal operation, not incidents) unless they
    represent a 5xx, which means something we control actually broke.
    """
    detail = exc.log_message or exc.message
    line = f"{exc.code.value}: {detail}{_context_suffix(request, **exc.log_context)}"

    if exc.status_code >= 500:
        logger.error(line, exc_info=exc)
    else:
        logger.warning(line)

    return build_error_response(
        request,
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        errors=exc.errors,
        headers=exc.headers,
    )


# Framework-generated detail strings carry no useful information for a user;
# swap them for the taxonomy's wording rather than surfacing them verbatim.
_FRAMEWORK_DETAILS = {
    "not found",
    "method not allowed",
    "internal server error",
    "not authenticated",
    "forbidden",
    "unauthorized",
    "bad request",
    "unprocessable entity",
}


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """
    Safety net for `HTTPException` — raised by Starlette itself for unmatched
    routes and by any application code not yet migrated to `AppError`.

    A `detail` that is anything other than a plain string (FastAPI allows dicts
    and lists) is dropped rather than serialised, since its contents are
    unknown and could carry internals.
    """
    code = code_for_status(exc.status_code)
    detail = exc.detail if isinstance(exc.detail, str) else None
    if detail and detail.strip().lower() in _FRAMEWORK_DETAILS:
        detail = None

    if exc.status_code >= 500:
        logger.error(
            f"HTTPException {exc.status_code}: {exc.detail}{_context_suffix(request)}",
            exc_info=exc,
        )
    else:
        logger.info(f"HTTPException {exc.status_code}{_context_suffix(request)}")

    return build_error_response(
        request,
        code=code,
        message=detail,
        status_code=exc.status_code,
        headers=getattr(exc, "headers", None),
    )


# ── Validation ────────────────────────────────────────────────────────────────

# Pydantic's own `msg` values name types, models, and constraint internals
# ("Input should be a valid dictionary or instance of BlogMemberCreate"), so
# they are translated rather than forwarded. Unrecognised error types fall back
# to a generic sentence — new pydantic versions can add types, and the default
# must be safe rather than convenient.
_FIELD_MESSAGES: dict[str, str] = {
    "missing": "This field is required.",
    "string_type": "Enter a valid text value.",
    "int_type": "Enter a whole number.",
    "int_parsing": "Enter a whole number.",
    "float_type": "Enter a number.",
    "float_parsing": "Enter a number.",
    "bool_type": "Select yes or no.",
    "bool_parsing": "Select yes or no.",
    "date_type": "Enter a valid date.",
    "date_parsing": "Enter a valid date.",
    "date_from_datetime_parsing": "Enter a valid date.",
    "datetime_type": "Enter a valid date and time.",
    "datetime_parsing": "Enter a valid date and time.",
    "datetime_from_date_parsing": "Enter a valid date and time.",
    "uuid_parsing": "Enter a valid identifier.",
    "url_parsing": "Enter a valid web address.",
    "url_scheme": "Enter a valid web address.",
    "json_invalid": "This value isn't formatted correctly.",
    "list_type": "Select one or more options.",
    "dict_type": "This value isn't formatted correctly.",
    "model_attributes_type": "This value isn't formatted correctly.",
    "string_pattern_mismatch": "This value isn't in the expected format.",
    "value_error": "This value isn't valid.",
    "enum": "Select one of the available options.",
    "literal_error": "Select one of the available options.",
}


def _humanize_field_error(error: Mapping[str, Any], field_path: str) -> str:
    error_type = str(error.get("type", ""))
    ctx = error.get("ctx") or {}

    # Length / range constraints read better with the actual bound, and the
    # bound itself is a business rule rather than an implementation detail.
    if error_type == "string_too_short":
        limit = ctx.get("min_length")
        if limit == 1:
            return "This field is required."
        return f"Must be at least {limit} characters." if limit else "This value is too short."
    if error_type == "string_too_long":
        limit = ctx.get("max_length")
        return f"Must be {limit} characters or fewer." if limit else "This value is too long."
    if error_type == "too_short":
        limit = ctx.get("min_length")
        return f"Select at least {limit}." if limit else "Select at least one option."
    if error_type == "too_long":
        limit = ctx.get("max_length")
        return f"Select no more than {limit}." if limit else "Too many options selected."
    if error_type in {"greater_than", "greater_than_equal"}:
        bound = ctx.get("gt", ctx.get("ge"))
        return f"Must be {bound} or greater." if bound is not None else "This number is too small."
    if error_type in {"less_than", "less_than_equal"}:
        bound = ctx.get("lt", ctx.get("le"))
        return f"Must be {bound} or less." if bound is not None else "This number is too large."

    # EmailStr surfaces as a generic `value_error` whose msg embeds the
    # validator's own explanation; recognise it by field name instead.
    if error_type == "value_error" and "email" in field_path.lower():
        return "Enter a valid email address."

    return _FIELD_MESSAGES.get(error_type, "This value isn't valid.")


def _field_path(location: tuple[Any, ...]) -> str:
    """
    Turn a pydantic `loc` into a client-meaningful field path.

    Drops the leading source segment (`body`, `query`, `path`) since the client
    already knows where it put the value, and joins nested paths with dots:
    `("body", "items", 0, "name")` -> `items.0.name`.
    """
    parts = list(location)
    if parts and parts[0] in {"body", "query", "path", "header", "cookie"}:
        parts = parts[1:]
    if not parts:
        return "request"
    return ".".join(str(part) for part in parts)


def _collect_field_errors(errors: list[Mapping[str, Any]]) -> dict[str, str]:
    collected: dict[str, str] = {}
    for error in errors:
        path = _field_path(tuple(error.get("loc", ())))
        # First error per field wins — it's the most specific one pydantic hit.
        collected.setdefault(path, _humanize_field_error(error, path))
    return collected


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Malformed or incomplete request payloads (FastAPI's 422 path)."""
    field_errors = _collect_field_errors(exc.errors())
    logger.info(
        f"Request validation failed for {sorted(field_errors)}{_context_suffix(request)}"
    )
    return build_error_response(
        request,
        code=ErrorCode.VALIDATION_ERROR,
        errors=field_errors,
    )


async def response_validation_exception_handler(
    request: Request, exc: ResponseValidationError
) -> JSONResponse:
    """
    A response failed its own `response_model`.

    This is a server bug, never the caller's fault, so it must not come back as
    a 422 describing our internal schema. Full detail goes to the log.
    """
    logger.error(
        f"Response model validation failed{_context_suffix(request)}", exc_info=exc
    )
    return build_error_response(request, code=ErrorCode.INTERNAL_ERROR)


async def pydantic_validation_exception_handler(
    request: Request, exc: PydanticValidationError
) -> JSONResponse:
    """
    A bare pydantic `ValidationError` escaping from service code — e.g.
    `model_validate` on data loaded from the database.

    That is a data/consistency problem on our side, not something the caller
    can fix by editing a form, so it is reported as an internal error.
    """
    logger.error(
        f"Unhandled pydantic validation error{_context_suffix(request)}", exc_info=exc
    )
    return build_error_response(request, code=ErrorCode.INTERNAL_ERROR)


# ── Database ──────────────────────────────────────────────────────────────────

# Postgres SQLSTATE classes we can turn into a meaningful public message.
_PG_UNIQUE_VIOLATION = "23505"
_PG_FOREIGN_KEY_VIOLATION = "23503"
_PG_NOT_NULL_VIOLATION = "23502"
_PG_CHECK_VIOLATION = "23514"

# Constraint/column fragments -> the conflict code they imply. Matched against
# the driver's own message, which stays server-side; only the mapped code and
# its registry message are ever returned.
_CONFLICT_HINTS: tuple[tuple[tuple[str, ...], ErrorCode], ...] = (
    (("email",), ErrorCode.EMAIL_ALREADY_EXISTS),
    (("username",), ErrorCode.USERNAME_ALREADY_EXISTS),
    (("slug", "subdomain"), ErrorCode.SLUG_ALREADY_EXISTS),
)


def _sqlstate(exc: DBAPIError) -> str:
    """SQLSTATE for drivers that expose one (psycopg2); '' for sqlite."""
    orig = getattr(exc, "orig", None)
    return str(getattr(orig, "pgcode", "") or "")


def _classify_integrity_error(exc: IntegrityError) -> tuple[ErrorCode, Optional[str]]:
    """
    Map a driver-level constraint violation to a public code.

    The driver text is inspected here, in one place, and is never returned —
    this is exactly the transformation that stops
    `duplicate key value violates unique constraint "users_email_key"` from
    reaching a client.
    """
    raw = str(getattr(exc, "orig", exc)).lower()
    sqlstate = _sqlstate(exc)

    is_unique = sqlstate == _PG_UNIQUE_VIOLATION or "unique constraint" in raw
    if is_unique:
        for fragments, code in _CONFLICT_HINTS:
            if any(fragment in raw for fragment in fragments):
                return code, None
        return ErrorCode.RESOURCE_ALREADY_EXISTS, None

    if sqlstate == _PG_FOREIGN_KEY_VIOLATION or "foreign key constraint" in raw:
        return (
            ErrorCode.INVALID_INPUT,
            "One of the items you selected is no longer available. Please refresh and try again.",
        )

    if sqlstate == _PG_NOT_NULL_VIOLATION or "not null constraint" in raw:
        return ErrorCode.VALIDATION_ERROR, "Some required information is missing."

    if sqlstate == _PG_CHECK_VIOLATION or "check constraint" in raw:
        return ErrorCode.INVALID_INPUT, None

    return ErrorCode.INTERNAL_ERROR, None


async def integrity_error_handler(
    request: Request, exc: IntegrityError
) -> JSONResponse:
    code, message = _classify_integrity_error(exc)
    logger.error(f"Database integrity error{_context_suffix(request)}", exc_info=exc)
    return build_error_response(request, code=code, message=message)


async def operational_error_handler(
    request: Request, exc: OperationalError
) -> JSONResponse:
    """Connection loss, pool exhaustion, timeouts — transient, so 503."""
    logger.error(f"Database unavailable{_context_suffix(request)}", exc_info=exc)
    return build_error_response(request, code=ErrorCode.SERVICE_UNAVAILABLE)


async def sqlalchemy_error_handler(
    request: Request, exc: SQLAlchemyError
) -> JSONResponse:
    """Everything else from the ORM/driver — always opaque to the client."""
    logger.error(f"Database error{_context_suffix(request)}", exc_info=exc)
    return build_error_response(request, code=ErrorCode.INTERNAL_ERROR)


# ── Last resort ───────────────────────────────────────────────────────────────


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Anything that reaches here is a bug. Log it in full, tell the user nothing
    beyond the request ID they can quote to support.

    Also invoked directly by `RequestContextMiddleware` so that failures
    originating above the router still produce this exact response.
    """
    logger.exception(
        f"Unhandled {type(exc).__name__}{_context_suffix(request)}", exc_info=exc
    )
    return build_error_response(request, code=ErrorCode.INTERNAL_ERROR)


# ── Registration ──────────────────────────────────────────────────────────────


def register_exception_handlers(app: FastAPI) -> None:
    """
    Wire the handlers onto the app.

    Order is irrelevant to Starlette (it dispatches on the most specific
    registered class), but the grouping below reads as the taxonomy does:
    application errors first, framework second, storage third, catch-all last.
    """
    app.add_exception_handler(AppError, app_error_handler)

    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ResponseValidationError, response_validation_exception_handler)
    app.add_exception_handler(PydanticValidationError, pydantic_validation_exception_handler)

    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(OperationalError, operational_error_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)

    app.add_exception_handler(Exception, unhandled_exception_handler)
