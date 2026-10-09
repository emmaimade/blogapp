"""
Public API error taxonomy
=========================

Every error the API returns to a client carries one of these codes. The code is
the *stable* contract — frontends should branch on `code`, never on the prose in
`message`, which is free to be reworded at any time.

Each code maps to exactly one HTTP status and one default user-facing message via
`ERROR_SPECS`. Those messages are the only error text the outside world ever
sees, so they must stay:

- non-technical (no framework, driver, or ORM vocabulary)
- specific enough to act on
- safe to show to an anonymous visitor

To add a new error: add the enum member, add its `ErrorSpec`. Nothing else.
"""

from typing import NamedTuple

from enum import Enum

from fastapi import status


class ErrorSpec(NamedTuple):
    """The HTTP status and default public message backing one error code."""

    status_code: int
    message: str


class ErrorCode(str, Enum):
    # ── Authentication ────────────────────────────────────────────────────────
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    INVALID_TOKEN = "INVALID_TOKEN"
    ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE"
    EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED"
    PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED"
    INCORRECT_PASSWORD = "INCORRECT_PASSWORD"
    CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID"

    # ── Authorization ─────────────────────────────────────────────────────────
    FORBIDDEN = "FORBIDDEN"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"
    SUPER_ADMIN_REQUIRED = "SUPER_ADMIN_REQUIRED"
    NOT_A_MEMBER = "NOT_A_MEMBER"
    ONBOARDING_INCOMPLETE = "ONBOARDING_INCOMPLETE"
    PLAN_UPGRADE_REQUIRED = "PLAN_UPGRADE_REQUIRED"

    # ── Resources ─────────────────────────────────────────────────────────────
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    POST_NOT_FOUND = "POST_NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    BLOG_NOT_FOUND = "BLOG_NOT_FOUND"
    COMMENT_NOT_FOUND = "COMMENT_NOT_FOUND"
    TAG_NOT_FOUND = "TAG_NOT_FOUND"
    MEDIA_NOT_FOUND = "MEDIA_NOT_FOUND"
    MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND"
    INVITATION_NOT_FOUND = "INVITATION_NOT_FOUND"
    TICKET_NOT_FOUND = "TICKET_NOT_FOUND"
    NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND"
    SUBSCRIPTION_NOT_FOUND = "SUBSCRIPTION_NOT_FOUND"
    MODERATION_ITEM_NOT_FOUND = "MODERATION_ITEM_NOT_FOUND"

    # ── Conflicts ─────────────────────────────────────────────────────────────
    RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS"
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS"
    USERNAME_ALREADY_EXISTS = "USERNAME_ALREADY_EXISTS"
    SLUG_ALREADY_EXISTS = "SLUG_ALREADY_EXISTS"
    TAG_ALREADY_EXISTS = "TAG_ALREADY_EXISTS"
    ALREADY_A_MEMBER = "ALREADY_A_MEMBER"
    INVITATION_ALREADY_ACCEPTED = "INVITATION_ALREADY_ACCEPTED"
    EMAIL_ALREADY_VERIFIED = "EMAIL_ALREADY_VERIFIED"

    # ── Expired / gone ────────────────────────────────────────────────────────
    LINK_EXPIRED = "LINK_EXPIRED"
    INVITATION_EXPIRED = "INVITATION_EXPIRED"

    # ── Validation & bad input ────────────────────────────────────────────────
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_INPUT = "INVALID_INPUT"
    WEAK_PASSWORD = "WEAK_PASSWORD"
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"

    # ── Business rules ────────────────────────────────────────────────────────
    OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED"

    # ── Billing ───────────────────────────────────────────────────────────────
    BILLING_NOT_CONFIGURED = "BILLING_NOT_CONFIGURED"
    PAYMENT_PROVIDER_ERROR = "PAYMENT_PROVIDER_ERROR"
    PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND"
    PAYMENT_NOT_SUCCESSFUL = "PAYMENT_NOT_SUCCESSFUL"
    ALREADY_SUBSCRIBED = "ALREADY_SUBSCRIBED"
    NO_ACTIVE_SUBSCRIPTION = "NO_ACTIVE_SUBSCRIPTION"
    INVALID_WEBHOOK_SIGNATURE = "INVALID_WEBHOOK_SIGNATURE"
    WORKSPACE_FULL = "WORKSPACE_FULL"
    WORKSPACE_LIMIT_REACHED = "WORKSPACE_LIMIT_REACHED"
    PAYMENT_METHOD_REQUIRED = "PAYMENT_METHOD_REQUIRED"
    NO_PENDING_CHANGE = "NO_PENDING_CHANGE"

    # ── Throttling ────────────────────────────────────────────────────────────
    RATE_LIMITED = "RATE_LIMITED"

    # ── Server & infrastructure ───────────────────────────────────────────────
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    UPLOAD_FAILED = "UPLOAD_FAILED"


_GENERIC_RETRY = "Something went wrong while processing your request. Please try again."


ERROR_SPECS: dict[ErrorCode, ErrorSpec] = {
    # ── Authentication ────────────────────────────────────────────────────────
    # Deliberately identical wording whether the account exists or the password
    # is wrong — the response must not confirm that an address is registered.
    ErrorCode.INVALID_CREDENTIALS: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "Email or password is incorrect.",
    ),
    ErrorCode.AUTHENTICATION_REQUIRED: ErrorSpec(
        status.HTTP_401_UNAUTHORIZED,
        "Please log in to continue.",
    ),
    ErrorCode.SESSION_EXPIRED: ErrorSpec(
        status.HTTP_401_UNAUTHORIZED,
        "Your session has expired. Please log in again.",
    ),
    ErrorCode.INVALID_TOKEN: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "This link is invalid or has already been used.",
    ),
    ErrorCode.ACCOUNT_INACTIVE: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "This account is no longer active. Please contact support.",
    ),
    ErrorCode.EMAIL_NOT_VERIFIED: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "Please verify your email address to continue.",
    ),
    ErrorCode.PASSWORD_CHANGE_REQUIRED: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "You must set a new password before continuing.",
    ),
    ErrorCode.INCORRECT_PASSWORD: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "Your current password is incorrect.",
    ),
    ErrorCode.CSRF_TOKEN_INVALID: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "Your session could not be verified. Please refresh the page and try again.",
    ),

    # ── Authorization ─────────────────────────────────────────────────────────
    ErrorCode.FORBIDDEN: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "You don't have permission to perform this action.",
    ),
    ErrorCode.INSUFFICIENT_PERMISSIONS: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "Your role doesn't allow this action. Ask a workspace owner for access.",
    ),
    ErrorCode.SUPER_ADMIN_REQUIRED: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "You don't have permission to perform this action.",
    ),
    ErrorCode.NOT_A_MEMBER: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "You don't have access to this workspace.",
    ),
    ErrorCode.ONBOARDING_INCOMPLETE: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "Please finish setting up your workspace first.",
    ),
    ErrorCode.PLAN_UPGRADE_REQUIRED: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "This feature isn't included in your current plan.",
    ),

    # ── Resources ─────────────────────────────────────────────────────────────
    ErrorCode.RESOURCE_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The item you're looking for could not be found.",
    ),
    ErrorCode.POST_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The post you're looking for could not be found.",
    ),
    ErrorCode.USER_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "We couldn't find that user.",
    ),
    ErrorCode.BLOG_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The workspace you're looking for could not be found.",
    ),
    ErrorCode.COMMENT_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The comment you're looking for could not be found.",
    ),
    ErrorCode.TAG_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The tag you're looking for could not be found.",
    ),
    ErrorCode.MEDIA_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The file you're looking for could not be found.",
    ),
    ErrorCode.MEMBER_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "That team member is not part of this workspace.",
    ),
    ErrorCode.INVITATION_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "This invitation is no longer valid. Ask for a new invite.",
    ),
    ErrorCode.TICKET_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The support ticket you're looking for could not be found.",
    ),
    ErrorCode.NOTIFICATION_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "The notification you're looking for could not be found.",
    ),
    ErrorCode.SUBSCRIPTION_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "No subscription was found for this workspace.",
    ),
    ErrorCode.MODERATION_ITEM_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "This moderation report could not be found.",
    ),

    # ── Conflicts ─────────────────────────────────────────────────────────────
    ErrorCode.RESOURCE_ALREADY_EXISTS: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This already exists. Please use a different value.",
    ),
    ErrorCode.EMAIL_ALREADY_EXISTS: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "An account with this email already exists.",
    ),
    ErrorCode.USERNAME_ALREADY_EXISTS: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This username is already taken. Please choose another.",
    ),
    ErrorCode.SLUG_ALREADY_EXISTS: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This address is already taken. Please choose another.",
    ),
    ErrorCode.TAG_ALREADY_EXISTS: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "A tag with this name already exists.",
    ),
    ErrorCode.ALREADY_A_MEMBER: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This person is already a member of this workspace.",
    ),
    ErrorCode.INVITATION_ALREADY_ACCEPTED: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This invitation has already been accepted.",
    ),
    ErrorCode.EMAIL_ALREADY_VERIFIED: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This email address is already verified.",
    ),

    # ── Expired / gone ────────────────────────────────────────────────────────
    ErrorCode.LINK_EXPIRED: ErrorSpec(
        status.HTTP_410_GONE,
        "This link has expired. Please request a new one.",
    ),
    ErrorCode.INVITATION_EXPIRED: ErrorSpec(
        status.HTTP_410_GONE,
        "This invitation has expired. Ask for a new invite.",
    ),

    # ── Validation & bad input ────────────────────────────────────────────────
    ErrorCode.VALIDATION_ERROR: ErrorSpec(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Please correct the highlighted fields.",
    ),
    ErrorCode.INVALID_INPUT: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "Some of the information you provided isn't valid. Please check and try again.",
    ),
    ErrorCode.WEAK_PASSWORD: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "Password must be at least 8 characters and include both letters and numbers.",
    ),
    ErrorCode.INVALID_FILE_TYPE: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "That file type isn't supported. Please upload a different file.",
    ),
    ErrorCode.FILE_TOO_LARGE: ErrorSpec(
        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        "That file is too large. Please upload a smaller one.",
    ),

    # ── Business rules ────────────────────────────────────────────────────────
    ErrorCode.OPERATION_NOT_ALLOWED: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "This action can't be completed right now.",
    ),

    # ── Billing ───────────────────────────────────────────────────────────────
    ErrorCode.BILLING_NOT_CONFIGURED: ErrorSpec(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Billing isn't available right now. Please try again later.",
    ),
    ErrorCode.PAYMENT_PROVIDER_ERROR: ErrorSpec(
        status.HTTP_502_BAD_GATEWAY,
        "We couldn't reach our payment provider. Please try again.",
    ),
    ErrorCode.PAYMENT_NOT_FOUND: ErrorSpec(
        status.HTTP_404_NOT_FOUND,
        "We couldn't find that payment for this workspace.",
    ),
    ErrorCode.PAYMENT_NOT_SUCCESSFUL: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "Your payment wasn't completed. You haven't been charged.",
    ),
    ErrorCode.ALREADY_SUBSCRIBED: ErrorSpec(
        status.HTTP_409_CONFLICT,
        "This workspace is already on that plan.",
    ),
    ErrorCode.NO_ACTIVE_SUBSCRIPTION: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "This workspace doesn't have a paid subscription.",
    ),
    ErrorCode.INVALID_WEBHOOK_SIGNATURE: ErrorSpec(
        status.HTTP_401_UNAUTHORIZED,
        "The request signature is invalid.",
    ),
    # Shown to someone joining by invitation — deliberately says nothing
    # about the workspace's plan, which is the owner's business.
    ErrorCode.PAYMENT_METHOD_REQUIRED: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "We don't have a saved card for this workspace. Please go through checkout instead.",
    ),
    ErrorCode.NO_PENDING_CHANGE: ErrorSpec(
        status.HTTP_400_BAD_REQUEST,
        "There's no scheduled plan change to undo.",
    ),
    ErrorCode.WORKSPACE_FULL: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "This workspace can't take new members right now, so the invitation "
        "can't be accepted yet. Let the person who invited you know.",
    ),
    ErrorCode.WORKSPACE_LIMIT_REACHED: ErrorSpec(
        status.HTTP_403_FORBIDDEN,
        "You've reached the maximum number of workspaces you can own. "
        "Contact support if you need more.",
    ),

    # ── Throttling ────────────────────────────────────────────────────────────
    ErrorCode.RATE_LIMITED: ErrorSpec(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "You've tried that too many times. Please wait a moment and try again.",
    ),

    # ── Server & infrastructure ───────────────────────────────────────────────
    ErrorCode.INTERNAL_ERROR: ErrorSpec(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        _GENERIC_RETRY,
    ),
    ErrorCode.SERVICE_UNAVAILABLE: ErrorSpec(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "We couldn't complete your request right now. Please try again later.",
    ),
    ErrorCode.UPLOAD_FAILED: ErrorSpec(
        status.HTTP_502_BAD_GATEWAY,
        "We couldn't upload your file right now. Please try again.",
    ),
}


# Fallback used when something raises a bare `HTTPException` (including the ones
# Starlette raises itself for unmatched routes / methods) so even un-migrated
# code lands on a real code instead of a shapeless response.
STATUS_TO_CODE: dict[int, ErrorCode] = {
    status.HTTP_400_BAD_REQUEST: ErrorCode.INVALID_INPUT,
    status.HTTP_401_UNAUTHORIZED: ErrorCode.AUTHENTICATION_REQUIRED,
    status.HTTP_403_FORBIDDEN: ErrorCode.FORBIDDEN,
    status.HTTP_404_NOT_FOUND: ErrorCode.RESOURCE_NOT_FOUND,
    status.HTTP_405_METHOD_NOT_ALLOWED: ErrorCode.OPERATION_NOT_ALLOWED,
    status.HTTP_409_CONFLICT: ErrorCode.RESOURCE_ALREADY_EXISTS,
    status.HTTP_410_GONE: ErrorCode.LINK_EXPIRED,
    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE: ErrorCode.FILE_TOO_LARGE,
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: ErrorCode.INVALID_FILE_TYPE,
    status.HTTP_422_UNPROCESSABLE_ENTITY: ErrorCode.VALIDATION_ERROR,
    status.HTTP_429_TOO_MANY_REQUESTS: ErrorCode.RATE_LIMITED,
    status.HTTP_500_INTERNAL_SERVER_ERROR: ErrorCode.INTERNAL_ERROR,
    status.HTTP_502_BAD_GATEWAY: ErrorCode.SERVICE_UNAVAILABLE,
    status.HTTP_503_SERVICE_UNAVAILABLE: ErrorCode.SERVICE_UNAVAILABLE,
    status.HTTP_504_GATEWAY_TIMEOUT: ErrorCode.SERVICE_UNAVAILABLE,
}


def spec_for(code: ErrorCode) -> ErrorSpec:
    """Look up the status/message pair for a code, defaulting to a safe 500."""
    return ERROR_SPECS.get(code, ERROR_SPECS[ErrorCode.INTERNAL_ERROR])


def code_for_status(status_code: int) -> ErrorCode:
    """Best-effort code for a raw HTTP status, for un-migrated raise sites."""
    if status_code in STATUS_TO_CODE:
        return STATUS_TO_CODE[status_code]
    if 500 <= status_code:
        return ErrorCode.INTERNAL_ERROR
    return ErrorCode.INVALID_INPUT
