"""
Application exceptions
======================

The single way application code signals a failure to the client.

Raise one of these instead of `HTTPException`. The status code and the public
message both come from the `ErrorCode` registry, so a raise site is usually just:

    raise NotFoundError(ErrorCode.POST_NOT_FOUND)

The point of routing everything through here is that the *public* message can
only ever come from `error_codes.ERROR_SPECS` (or an explicit, deliberately
written override). There is no code path that can put an exception's `str()`
into a response body — anything technical you want to keep goes in
`log_message`, which is written to the server log and never serialised.

    raise ExternalServiceError(
        ErrorCode.UPLOAD_FAILED,
        log_message=f"cloudinary rejected upload: {exc}",   # log only
    )
"""

from typing import Any, Mapping, Optional

from app.core.error_codes import ErrorCode, spec_for


class AppError(Exception):
    """
    Base class for every expected, client-visible failure.

    Attributes
    ----------
    code
        Stable machine-readable identifier returned as `code`.
    message
        Safe, user-facing prose returned as `message` (and mirrored to `detail`
        for backwards compatibility with existing frontend clients).
    status_code
        HTTP status for the response.
    errors
        Optional per-field map for validation failures.
    log_message
        Technical context for the server log. Never leaves the process.
    headers
        Optional response headers (e.g. `WWW-Authenticate`, `Retry-After`).
    """

    default_code: ErrorCode = ErrorCode.INTERNAL_ERROR

    def __init__(
        self,
        code: Optional[ErrorCode] = None,
        message: Optional[str] = None,
        *,
        status_code: Optional[int] = None,
        errors: Optional[Mapping[str, str]] = None,
        log_message: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
        log_context: Optional[Mapping[str, Any]] = None,
    ) -> None:
        self.code = code or self.default_code
        spec = spec_for(self.code)
        self.message = message or spec.message
        self.status_code = status_code or spec.status_code
        self.errors = dict(errors) if errors else None
        self.log_message = log_message
        self.headers = headers
        self.log_context = dict(log_context) if log_context else {}
        super().__init__(self.log_message or self.message)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"{type(self).__name__}(code={self.code.value}, status={self.status_code})"


# ── Category classes ──────────────────────────────────────────────────────────
# Each one only fixes a sensible default code; the specific code passed at the
# raise site is what actually determines status and message.


class AuthenticationError(AppError):
    """401 — the caller is not identified, or their credentials didn't check out."""

    default_code = ErrorCode.AUTHENTICATION_REQUIRED


class AuthorizationError(AppError):
    """403 — the caller is known but isn't allowed to do this."""

    default_code = ErrorCode.FORBIDDEN


class NotFoundError(AppError):
    """404 — the addressed resource doesn't exist, or isn't visible to this caller."""

    default_code = ErrorCode.RESOURCE_NOT_FOUND


class ConflictError(AppError):
    """409 — the request collides with existing state."""

    default_code = ErrorCode.RESOURCE_ALREADY_EXISTS


class GoneError(AppError):
    """410 — the resource existed but has expired."""

    default_code = ErrorCode.LINK_EXPIRED


class ValidationError(AppError):
    """
    422 — the payload was structurally understood but semantically invalid.

    Carries a `{field: message}` map so the client can highlight inputs.
    """

    default_code = ErrorCode.VALIDATION_ERROR


class BadRequestError(AppError):
    """
    400 — a well-formed request that breaks a business rule.

    Use this (not `ValidationError`) when the problem isn't attributable to one
    named field, e.g. "you can't remove the workspace owner".
    """

    default_code = ErrorCode.INVALID_INPUT


class RateLimitError(AppError):
    """429 — the caller is going too fast."""

    default_code = ErrorCode.RATE_LIMITED

    def __init__(
        self,
        code: Optional[ErrorCode] = None,
        message: Optional[str] = None,
        *,
        retry_after_seconds: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        headers = dict(kwargs.pop("headers", None) or {})
        if retry_after_seconds is not None:
            headers.setdefault("Retry-After", str(retry_after_seconds))
        self.retry_after_seconds = retry_after_seconds
        super().__init__(code, message, headers=headers or None, **kwargs)


class ExternalServiceError(AppError):
    """
    502/503 — an upstream we depend on (mail, media storage) failed.

    The upstream's own error text is a leak risk and belongs in `log_message`.
    """

    default_code = ErrorCode.SERVICE_UNAVAILABLE


class InternalError(AppError):
    """
    500 — something we didn't anticipate.

    Rarely raised directly; the unhandled-exception handler produces this shape
    for anything that escapes without being an `AppError`.
    """

    default_code = ErrorCode.INTERNAL_ERROR


__all__ = [
    "AppError",
    "AuthenticationError",
    "AuthorizationError",
    "BadRequestError",
    "ConflictError",
    "ExternalServiceError",
    "GoneError",
    "InternalError",
    "NotFoundError",
    "RateLimitError",
    "ValidationError",
]
