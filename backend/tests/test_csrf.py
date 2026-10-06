"""
Coverage for the double-submit CSRF check (app/core/csrf_middleware.py):
a state-changing request relying on the ambient access_token cookie needs a
matching X-CSRF-Token header; one that authenticates with an explicit
Authorization header is exempt, since that header can't be forged cross-site.
"""

import uuid

from app.core.security import ACCESS_TOKEN_COOKIE_NAME, CSRF_COOKIE_NAME


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client) -> dict:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": _unique_email(),
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_cookie_authenticated_request_without_csrf_header_is_rejected(client):
    _register(client)
    res = client.post(
        "/auth/change-password",
        json={"current_password": "correcthorse1", "new_password": "brandnewpass1"},
    )
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "CSRF_TOKEN_INVALID"


def test_cookie_authenticated_request_with_matching_csrf_header_succeeds(client):
    _register(client)
    csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
    res = client.post(
        "/auth/change-password",
        headers={"X-CSRF-Token": csrf_token},
        json={"current_password": "correcthorse1", "new_password": "brandnewpass1"},
    )
    assert res.status_code == 200, res.text


def test_cookie_authenticated_request_with_wrong_csrf_header_is_rejected(client):
    _register(client)
    res = client.post(
        "/auth/change-password",
        headers={"X-CSRF-Token": "not-the-right-token"},
        json={"current_password": "correcthorse1", "new_password": "brandnewpass1"},
    )
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "CSRF_TOKEN_INVALID"


def test_bearer_header_authenticated_request_is_exempt_from_csrf(client):
    _register(client)
    # Login/register respond with cookies only now; grab a usable bearer
    # token straight from the cookie the way a non-browser client would get
    # one if it authenticated with a header to begin with.
    from app.core.security import ACCESS_TOKEN_COOKIE_NAME

    token = client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)

    res = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "correcthorse1", "new_password": "brandnewpass1"},
    )
    assert res.status_code == 200, res.text
