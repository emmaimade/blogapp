"""
Error response schemas.

Documentation-facing only — the live responses are built by
`app.core.error_handlers.build_error_payload`. These exist so the OpenAPI spec
(and any generated client) describes the real error contract instead of
FastAPI's default `{"detail": …}` stub.
"""

from typing import Optional

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error envelope returned by every failing endpoint."""

    success: bool = Field(False, description="Always false on an error response.")
    message: str = Field(
        ...,
        description="Human-readable, user-safe explanation. Safe to display as-is.",
    )
    code: str = Field(
        ...,
        description=(
            "Stable machine-readable error identifier. Branch on this, not on "
            "`message`, which may be reworded at any time."
        ),
    )
    request_id: Optional[str] = Field(
        None,
        description="Correlation ID for this request; quote it when reporting a problem.",
    )
    detail: str = Field(
        ...,
        description="Deprecated alias of `message`, kept for existing clients.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": False,
                "message": "The post you're looking for could not be found.",
                "code": "POST_NOT_FOUND",
                "request_id": "3f9a1c74e8b24d5f9c0a1b2c3d4e5f60",
                "detail": "The post you're looking for could not be found.",
            }
        }
    }


class ValidationErrorResponse(ErrorResponse):
    """Error envelope for field-level validation failures (HTTP 422)."""

    errors: dict[str, str] = Field(
        default_factory=dict,
        description="Field path to the correction the user needs to make.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": False,
                "message": "Please correct the highlighted fields.",
                "code": "VALIDATION_ERROR",
                "errors": {
                    "title": "This field is required.",
                    "email": "Enter a valid email address.",
                },
                "request_id": "3f9a1c74e8b24d5f9c0a1b2c3d4e5f60",
                "detail": "Please correct the highlighted fields.",
            }
        }
    }
