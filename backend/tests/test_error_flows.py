"""
End-to-end error behaviour on real business flows.

The tests in `test_error_handling.py` inject faults; these drive genuine
endpoints so the envelope is verified against the actual routers, dependencies,
and middleware — including that successful responses were left alone.
"""

import uuid

import pytest

from tests.test_error_handling import assert_envelope, assert_no_internal_leak
from app.core.error_codes import ErrorCode


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client, email: str, password: str = "correcthorse1"):
    return client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": email,
            "password": password,
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )


@pytest.fixture()
def registered_user(client):
    email = _unique_email()
    response = _register(client, email)
    assert response.status_code == 200, response.text
    return {"email": email, "password": "correcthorse1", "body": response.json()}


# ── Successful responses must be untouched ────────────────────────────────────


def test_registration_success_response_shape_is_unchanged(registered_user):
    """
    The refactor must not have leaked the error envelope into success bodies —
    no `success` key, no `code`, and the original payload intact.
    """
    body = registered_user["body"]
    assert body["message"] == "Login successful"
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == registered_user["email"]
    assert "success" not in body
    assert "code" not in body


def test_login_success_is_unchanged(client, registered_user):
    response = client.post(
        "/auth/login",
        data={"username": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["access_token"]
    assert "success" not in body


def test_authenticated_read_still_works(client, registered_user):
    token = registered_user["body"]["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert response.json()["email"] == registered_user["email"]


# ── Conflicts ─────────────────────────────────────────────────────────────────


def test_registering_a_duplicate_email_is_a_conflict(client, registered_user):
    """
    Previously a 400 reading "Email already exists"; now a 409 with a code the
    signup form can branch on.
    """
    response = _register(client, registered_user["email"])
    payload = assert_envelope(
        response, status_code=409, code=ErrorCode.EMAIL_ALREADY_EXISTS
    )
    assert payload["message"] == "An account with this email already exists."


def test_registration_rejects_a_weak_password(client):
    """
    /users/register is the endpoint both the public blog's signup form (which
    has no client-side password check at all) and the site's signup form post
    to — the server-side check is the only one guaranteed to run.
    """
    response = _register(client, _unique_email(), password="short")
    payload = assert_envelope(response, status_code=400, code=ErrorCode.WEAK_PASSWORD)
    assert payload["errors"]["password"] == (
        "Use at least 8 characters, including both letters and numbers."
    )


def test_registration_rejects_a_password_with_no_digits(client):
    response = _register(client, _unique_email(), password="alletters")
    assert_envelope(response, status_code=400, code=ErrorCode.WEAK_PASSWORD)


def test_registration_accepts_a_password_meeting_the_policy(client):
    response = _register(client, _unique_email(), password="correcthorse1")
    assert response.status_code == 200, response.text


def test_duplicate_email_is_reported_even_with_a_weak_password(client, registered_user):
    """
    The email-uniqueness check runs first, so a weak-password + duplicate-email
    request reports the conflict, not the password problem — consistent with
    this endpoint already treating "email taken" as safe to disclose during
    registration (unlike login, which deliberately stays ambiguous).
    """
    response = _register(client, registered_user["email"], password="short")
    assert_envelope(response, status_code=409, code=ErrorCode.EMAIL_ALREADY_EXISTS)


# ── Authentication on a real credential check ─────────────────────────────────


def test_wrong_password_for_a_real_account_is_indistinguishable_from_unknown(
    client, registered_user
):
    """
    Both branches must produce byte-identical bodies apart from the request id,
    or the endpoint becomes an account-existence oracle.
    """
    wrong_password = client.post(
        "/auth/login",
        data={"username": registered_user["email"], "password": "wrongpassword1"},
    )
    unknown_account = client.post(
        "/auth/login",
        data={"username": _unique_email(), "password": "wrongpassword1"},
    )

    for response in (wrong_password, unknown_account):
        assert_envelope(response, status_code=400, code=ErrorCode.INVALID_CREDENTIALS)

    a = wrong_password.json()
    b = unknown_account.json()
    a.pop("request_id")
    b.pop("request_id")
    assert a == b


# ── Rate limiting on a real flow ──────────────────────────────────────────────


def test_password_reset_requests_are_throttled(client, registered_user):
    """
    A second reset request inside the cooldown used to be converted to a 429 by
    hand at three separate call sites, with two different wordings. It now
    propagates as an AppError and the central handler adds Retry-After.
    """
    first = client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    assert first.status_code == 200, first.text

    second = client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    payload = assert_envelope(second, status_code=429, code=ErrorCode.RATE_LIMITED)
    assert "Retry-After" in second.headers
    assert "wait" in payload["message"].lower()


def test_forgot_password_does_not_disclose_unknown_accounts(client):
    """An address with no account gets the same 200 as one that has one."""
    response = client.post("/auth/forgot-password", json={"email": _unique_email()})
    assert response.status_code == 200
    assert "not" not in response.json()["message"].lower().split("registered")[0][:20]
    assert_no_internal_leak(response)


# ── Weak passwords ────────────────────────────────────────────────────────────


def test_password_change_rejects_a_weak_password(client, registered_user):
    token = registered_user["body"]["access_token"]
    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": registered_user["password"], "new_password": "short"},
    )
    payload = assert_envelope(response, status_code=400, code=ErrorCode.WEAK_PASSWORD)
    assert payload["errors"]["new_password"] == (
        "Use at least 8 characters, including both letters and numbers."
    )


def test_password_change_rejects_a_wrong_current_password(client, registered_user):
    token = registered_user["body"]["access_token"]
    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "definitelywrong1", "new_password": "brandnewpass1"},
    )
    payload = assert_envelope(
        response, status_code=400, code=ErrorCode.INCORRECT_PASSWORD
    )
    assert "current_password" in payload["errors"]


# ── Authorization on a real workspace ─────────────────────────────────────────


def test_non_member_cannot_read_another_workspace_dashboard(client, registered_user):
    """
    A second account asking for the first account's workspace gets a typed 403
    rather than the old ad-hoc "Not a member of this blog" string.
    """
    blog_id = registered_user["body"]["user"]["blog_memberships"][0]["blog_id"]

    outsider = _register(client, _unique_email())
    assert outsider.status_code == 200, outsider.text
    outsider_token = outsider.json()["access_token"]

    response = client.get(
        f"/blogs/{blog_id}/dashboard",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert_envelope(response, status_code=403, code=ErrorCode.NOT_A_MEMBER)


def test_superadmin_area_is_closed_to_ordinary_accounts(client, registered_user):
    token = registered_user["body"]["access_token"]
    response = client.get("/superadmin/stats", headers={"Authorization": f"Bearer {token}"})
    assert_envelope(response, status_code=403, code=ErrorCode.SUPER_ADMIN_REQUIRED)


# ── Not found on a real workspace ─────────────────────────────────────────────


def test_missing_post_in_a_real_workspace(client, registered_user):
    blog_id = registered_user["body"]["user"]["blog_memberships"][0]["blog_id"]
    token = registered_user["body"]["access_token"]

    response = client.get(
        f"/blogs/{blog_id}/posts/9999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert_envelope(response, status_code=404, code=ErrorCode.POST_NOT_FOUND)


def test_missing_tag_in_a_real_workspace(client, registered_user):
    blog_id = registered_user["body"]["user"]["blog_memberships"][0]["blog_id"]
    token = registered_user["body"]["access_token"]

    response = client.delete(
        f"/blogs/{blog_id}/tags/9999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Onboarding is still incomplete for a freshly registered workspace, so the
    # gate fires before the lookup — either way it is a taxonomy code, never a
    # raw framework response.
    assert response.status_code in (403, 404)
    payload = response.json()
    assert payload["code"] in (
        ErrorCode.ONBOARDING_INCOMPLETE.value,
        ErrorCode.TAG_NOT_FOUND.value,
        ErrorCode.INSUFFICIENT_PERMISSIONS.value,
    )
    assert_no_internal_leak(response)


# ── Invitations ───────────────────────────────────────────────────────────────


def test_unknown_invitation_token_is_a_typed_404(client):
    response = client.get("/invitations/definitely-not-a-real-token")
    assert_envelope(response, status_code=404, code=ErrorCode.INVITATION_NOT_FOUND)


def test_support_ticket_requires_a_subject_and_body(client, registered_user):
    token = registered_user["body"]["access_token"]
    response = client.post(
        "/support/",
        headers={"Authorization": f"Bearer {token}"},
        json={"subject": "   ", "body": ""},
    )
    payload = assert_envelope(
        response, status_code=422, code=ErrorCode.VALIDATION_ERROR
    )
    assert payload["errors"]["subject"] == "This field is required."
    assert payload["errors"]["body"] == "This field is required."
