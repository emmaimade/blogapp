"""
Error-handling contract tests.

Two things are being pinned down here:

1. Every failure — expected or not — comes back in one envelope, with the right
   status and a code from the taxonomy.
2. Nothing technical crosses the boundary. `assert_no_internal_leak` is applied
   to every response body in this module and is the test that actually matters:
   if someone later adds a handler that interpolates an exception into a
   response, it fails here.
"""

import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import APIRouter, FastAPI
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.config import ALGORITHM, SECRET_KEY
from app.core.error_codes import ERROR_SPECS, ErrorCode
from app.core.error_handlers import _classify_integrity_error
from app.core.exceptions import (
    AuthorizationError,
    BadRequestError,
    ConflictError,
    ExternalServiceError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from app.main import app

# Substrings that must never appear in a response body. Each one stands for a
# category the brief calls out: driver/ORM internals, Python internals, file
# system layout, SQL, and upstream provider detail.
FORBIDDEN_FRAGMENTS = (
    "traceback",
    'file "',
    ".py",
    "sqlalchemy",
    "psycopg2",
    "sqlite3",
    "operationalerror",
    "integrityerror",
    "duplicate key",
    "unique constraint",
    "violates",
    "pydantic",
    "starlette",
    "valueerror",
    "typeerror",
    "keyerror",
    "attributeerror",
    "select ",
    "insert into",
    "cloudinary",
    "site-packages",
    "self.",
)


def assert_no_internal_leak(response):
    """Fail if the serialised body contains anything implementation-shaped."""
    body = response.text.lower()
    for fragment in FORBIDDEN_FRAGMENTS:
        assert fragment not in body, (
            f"response leaked {fragment!r}\n"
            f"status={response.status_code}\nbody={response.text}"
        )


def assert_envelope(response, *, status_code, code):
    """Assert the standard error shape, then return the parsed payload."""
    assert response.status_code == status_code, response.text
    payload = response.json()

    assert payload["success"] is False
    assert payload["code"] == code.value
    assert isinstance(payload["message"], str) and payload["message"]
    # `detail` mirrors `message` so the existing frontends keep working.
    assert payload["detail"] == payload["message"]
    assert payload["request_id"]

    assert_no_internal_leak(response)
    return payload


# ── Fault-injection routes ────────────────────────────────────────────────────
# Mounted on the real app so the assertions exercise the production middleware
# stack (CORS -> RequestContext -> audit -> password-change) and the real
# handler registrations, not a stand-in.


class _Widget(BaseModel):
    name: str


def _fake_integrity_error(message: str, pgcode: str | None = None) -> IntegrityError:
    class _Orig(Exception):
        pass

    orig = _Orig(message)
    if pgcode is not None:
        orig.pgcode = pgcode
    return IntegrityError("INSERT INTO users (email) VALUES (?)", {"email": "x"}, orig)


@pytest.fixture(scope="module", autouse=True)
def _fault_routes():
    router = APIRouter(prefix="/__faults__", include_in_schema=False)

    @router.get("/unexpected")
    def _unexpected():
        raise ValueError("connection string postgresql://admin:hunter2@db.internal/prod")

    @router.get("/uuid-serialisation")
    def _uuid_serialisation():
        raise TypeError("Object of type UUID is not JSON serializable")

    @router.get("/integrity-email")
    def _integrity_email():
        raise _fake_integrity_error(
            'duplicate key value violates unique constraint "users_email_key"',
            pgcode="23505",
        )

    @router.get("/integrity-slug")
    def _integrity_slug():
        raise _fake_integrity_error(
            'duplicate key value violates unique constraint "blog_subdomain_key"',
            pgcode="23505",
        )

    @router.get("/db-down")
    def _db_down():
        raise OperationalError(
            "SELECT 1", {}, Exception("could not connect to server: Connection refused")
        )

    @router.get("/upstream")
    def _upstream():
        raise ExternalServiceError(
            ErrorCode.UPLOAD_FAILED,
            log_message="cloudinary 401: api_key=1234567890 invalid signature",
        )

    @router.get("/bad-response-model", response_model=_Widget)
    def _bad_response_model():
        return {"unexpected": "shape"}

    @router.get("/rate-limited")
    def _rate_limited():
        raise RateLimitError(retry_after_seconds=42)

    @router.get("/field-errors")
    def _field_errors():
        raise ValidationError(errors={"title": "This field is required."})

    app.include_router(router)
    yield
    app.router.routes = [
        route
        for route in app.router.routes
        if not getattr(route, "path", "").startswith("/__faults__")
    ]


# ── Unexpected exceptions ─────────────────────────────────────────────────────


def test_unexpected_exception_returns_generic_envelope(client):
    response = client.get("/__faults__/unexpected")
    payload = assert_envelope(
        response, status_code=500, code=ErrorCode.INTERNAL_ERROR
    )
    assert payload["message"] == ERROR_SPECS[ErrorCode.INTERNAL_ERROR].message
    # The exception carried a database password; none of it may survive.
    assert "hunter2" not in response.text
    assert "db.internal" not in response.text


def test_uuid_serialisation_failure_is_not_exposed(client):
    """The brief's worked example: a serialisation TypeError stays internal."""
    response = client.get("/__faults__/uuid-serialisation")
    assert_envelope(response, status_code=500, code=ErrorCode.INTERNAL_ERROR)
    assert "UUID" not in response.text


def test_response_model_mismatch_is_a_server_error_not_a_validation_error(client):
    """
    A response that fails its own schema is our bug, so it must not come back
    as a 422 describing internal model fields.
    """
    response = client.get("/__faults__/bad-response-model")
    payload = assert_envelope(response, status_code=500, code=ErrorCode.INTERNAL_ERROR)
    assert "errors" not in payload
    assert "name" not in response.text


# ── Database failures ─────────────────────────────────────────────────────────


def test_duplicate_email_constraint_becomes_a_conflict(client):
    response = client.get("/__faults__/integrity-email")
    payload = assert_envelope(
        response, status_code=409, code=ErrorCode.EMAIL_ALREADY_EXISTS
    )
    assert payload["message"] == "An account with this email already exists."


def test_duplicate_slug_constraint_becomes_a_conflict(client):
    response = client.get("/__faults__/integrity-slug")
    assert_envelope(response, status_code=409, code=ErrorCode.SLUG_ALREADY_EXISTS)


def test_database_unavailable_is_reported_as_service_unavailable(client):
    response = client.get("/__faults__/db-down")
    assert_envelope(response, status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE)


@pytest.mark.parametrize(
    ("message", "pgcode", "expected"),
    [
        (
            'duplicate key value violates unique constraint "users_email_key"',
            "23505",
            ErrorCode.EMAIL_ALREADY_EXISTS,
        ),
        (
            'duplicate key value violates unique constraint "user_username_key"',
            "23505",
            ErrorCode.USERNAME_ALREADY_EXISTS,
        ),
        (
            "UNIQUE constraint failed: blog.slug",  # sqlite has no SQLSTATE
            None,
            ErrorCode.SLUG_ALREADY_EXISTS,
        ),
        (
            'duplicate key value violates unique constraint "tag_pkey"',
            "23505",
            ErrorCode.RESOURCE_ALREADY_EXISTS,
        ),
        (
            'insert violates foreign key constraint "post_blog_id_fkey"',
            "23503",
            ErrorCode.INVALID_INPUT,
        ),
        (
            'null value in column "title" violates not-null constraint',
            "23502",
            ErrorCode.VALIDATION_ERROR,
        ),
    ],
)
def test_integrity_error_classification(message, pgcode, expected):
    """Covers both drivers: psycopg2 exposes SQLSTATE, sqlite doesn't."""
    code, _ = _classify_integrity_error(_fake_integrity_error(message, pgcode))
    assert code is expected


# ── Upstream services ─────────────────────────────────────────────────────────


def test_upstream_failure_hides_provider_detail(client):
    response = client.get("/__faults__/upstream")
    assert_envelope(response, status_code=502, code=ErrorCode.UPLOAD_FAILED)
    assert "api_key" not in response.text
    assert "1234567890" not in response.text


# ── Authentication ────────────────────────────────────────────────────────────


def test_missing_token_requires_authentication(client):
    response = client.get("/auth/me")
    payload = assert_envelope(
        response, status_code=401, code=ErrorCode.AUTHENTICATION_REQUIRED
    )
    # FastAPI's own "Not authenticated" is replaced by taxonomy wording.
    assert payload["message"] == "Please log in to continue."


def test_malformed_token_requires_authentication(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert_envelope(response, status_code=401, code=ErrorCode.AUTHENTICATION_REQUIRED)


def test_expired_token_reports_an_expired_session(client):
    expired = jwt.encode(
        {"sub": "someone", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    payload = assert_envelope(
        response, status_code=401, code=ErrorCode.SESSION_EXPIRED
    )
    assert payload["message"] == "Your session has expired. Please log in again."


def test_wrong_password_does_not_reveal_whether_the_account_exists(client):
    """
    Login stays 400 (not 401) on purpose: the admin client treats any 401 as a
    dead session and hard-redirects, which would discard the inline message.
    """
    unknown = client.post(
        "/auth/login", data={"username": "nobody@example.com", "password": "whatever1"}
    )
    payload = assert_envelope(
        unknown, status_code=400, code=ErrorCode.INVALID_CREDENTIALS
    )
    assert payload["message"] == "Email or password is incorrect."


# ── Authorization ─────────────────────────────────────────────────────────────


def test_superadmin_route_rejects_anonymous_callers(client):
    response = client.get("/superadmin/stats")
    assert_envelope(response, status_code=401, code=ErrorCode.AUTHENTICATION_REQUIRED)


# ── Resources ─────────────────────────────────────────────────────────────────


def test_unknown_route_uses_the_standard_envelope(client):
    response = client.get("/no-such-endpoint")
    payload = assert_envelope(
        response, status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND
    )
    assert payload["message"] != "Not Found"


def test_wrong_method_is_reported_as_not_allowed(client):
    response = client.delete("/")
    assert_envelope(
        response, status_code=405, code=ErrorCode.OPERATION_NOT_ALLOWED
    )


def test_missing_blog_returns_a_specific_code(client):
    response = client.get("/blogs/98765432")
    payload = assert_envelope(response, status_code=404, code=ErrorCode.BLOG_NOT_FOUND)
    assert payload["message"] == "The workspace you're looking for could not be found."


def test_missing_post_returns_a_specific_code(client):
    """
    Posts hang off a blog, so an unknown blog id fails at the blog first —
    which is itself the right answer, and still a taxonomy code.
    """
    response = client.get("/blogs/98765432/posts/12345")
    assert_envelope(response, status_code=404, code=ErrorCode.BLOG_NOT_FOUND)


# ── Validation ────────────────────────────────────────────────────────────────


def test_missing_fields_are_reported_per_field(client):
    response = client.post("/users/register", json={})
    payload = assert_envelope(
        response, status_code=422, code=ErrorCode.VALIDATION_ERROR
    )
    assert payload["message"] == "Please correct the highlighted fields."

    errors = payload["errors"]
    assert errors["first_name"] == "This field is required."
    assert errors["last_name"] == "This field is required."
    assert errors["email"] == "This field is required."
    assert errors["password"] == "This field is required."


def test_validation_errors_drop_pydantic_internals(client):
    """
    FastAPI's default 422 body is a list of `{loc, msg, type, input, url}`.
    None of those keys — nor the docs URL — may survive the translation.
    """
    response = client.post("/users/register", json={"email": 12345})
    payload = assert_envelope(
        response, status_code=422, code=ErrorCode.VALIDATION_ERROR
    )

    serialised = json.dumps(payload)
    for leaked in ('"loc"', '"msg"', '"type"', '"input"', '"url"', "errors.pydantic.dev"):
        assert leaked not in serialised


def test_invalid_email_is_explained_in_plain_language(client):
    response = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "not-an-email",
            "password": "correcthorse1",
        },
    )
    payload = assert_envelope(
        response, status_code=422, code=ErrorCode.VALIDATION_ERROR
    )
    assert payload["errors"]["email"] == "Enter a valid email address."


def test_application_raised_validation_errors_carry_fields(client):
    response = client.get("/__faults__/field-errors")
    payload = assert_envelope(
        response, status_code=422, code=ErrorCode.VALIDATION_ERROR
    )
    assert payload["errors"] == {"title": "This field is required."}


# ── Rate limiting ─────────────────────────────────────────────────────────────


def test_rate_limit_sets_retry_after(client):
    response = client.get("/__faults__/rate-limited")
    assert_envelope(response, status_code=429, code=ErrorCode.RATE_LIMITED)
    assert response.headers["Retry-After"] == "42"


# ── Correlation ───────────────────────────────────────────────────────────────


def test_request_id_is_returned_on_success_and_failure(client):
    ok = client.get("/")
    assert ok.status_code == 200
    assert ok.headers["X-Request-ID"]

    failed = client.get("/__faults__/unexpected")
    assert failed.headers["X-Request-ID"] == failed.json()["request_id"]


def test_client_supplied_request_id_is_echoed(client):
    response = client.get(
        "/__faults__/unexpected", headers={"X-Request-ID": "trace-abc-123"}
    )
    assert response.json()["request_id"] == "trace-abc-123"


def test_hostile_request_id_is_rejected(client):
    """The ID reaches log output, so anything but a safe token is discarded."""
    response = client.get(
        "/__faults__/unexpected",
        headers={"X-Request-ID": "bad\nid: injected-log-line"},
    )
    request_id = response.json()["request_id"]
    assert "\n" not in request_id
    assert "injected" not in request_id


# ── Taxonomy invariants ───────────────────────────────────────────────────────


def test_every_error_code_has_a_spec():
    """A code without a spec would silently fall back to a 500."""
    missing = [code.value for code in ErrorCode if code not in ERROR_SPECS]
    assert missing == []


def test_error_messages_are_non_technical():
    for code, spec in ERROR_SPECS.items():
        message = spec.message.lower()
        for fragment in ("exception", "sql", "null", "traceback", "database", "server error"):
            assert fragment not in message, f"{code.value} message is technical"
        assert spec.message.endswith((".", "!")), f"{code.value} message is not a sentence"


@pytest.mark.parametrize(
    ("exception", "expected_status"),
    [
        (AuthorizationError(), 403),
        (NotFoundError(), 404),
        (ConflictError(), 409),
        (BadRequestError(), 400),
        (ValidationError(), 422),
        (RateLimitError(), 429),
        (ExternalServiceError(), 503),
    ],
)
def test_exception_categories_map_to_expected_statuses(exception, expected_status):
    assert exception.status_code == expected_status


def test_log_message_is_never_the_public_message():
    error = NotFoundError(
        ErrorCode.POST_NOT_FOUND, log_message="post 42 missing for tenant 7"
    )
    assert error.message == ERROR_SPECS[ErrorCode.POST_NOT_FOUND].message
    assert "tenant" not in error.message
    # str() is what a careless `detail=str(exc)` would pick up, so it must be
    # the log text — a reviewer seeing tenant ids there knows it can't be public.
    assert str(error) == "post 42 missing for tenant 7"


def test_handlers_are_registered_on_the_app():
    """Guards against the registration call being dropped from main.py."""
    registered = app.exception_handlers
    assert Exception in registered
    for exception_type in (IntegrityError, OperationalError):
        assert exception_type in registered
