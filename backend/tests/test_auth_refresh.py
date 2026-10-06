"""
Coverage for cookie-based JWT refresh/logout/revocation: login sets httpOnly
access_token/refresh_token/csrf_token cookies (no tokens in the JSON body),
/auth/refresh rotates the refresh cookie (old one rejected on reuse), and
/auth/logout revokes it and clears all three cookies.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME, CSRF_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME
from app.models import RefreshToken


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


def test_login_sets_auth_cookies_and_omits_tokens_from_the_body(client):
    body = _register(client)
    assert "access_token" not in body
    assert "refresh_token" not in body
    assert client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    assert client.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    assert client.cookies.get(CSRF_COOKIE_NAME)


def test_refresh_issues_a_new_access_token(client):
    _register(client)
    old_access_token = client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    old_refresh_token = client.cookies.get(REFRESH_TOKEN_COOKIE_NAME)

    res = client.post("/auth/refresh")
    assert res.status_code == 200, res.text

    # The refresh token always rotates (a fresh random value each time).
    assert client.cookies.get(REFRESH_TOKEN_COOKIE_NAME) != old_refresh_token
    assert client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)

    # The new access token cookie is actually usable.
    me = client.get("/auth/me")
    assert me.status_code == 200, me.text


def test_refresh_rotates_and_rejects_reuse_of_the_old_token(client):
    _register(client)
    original_refresh_token = client.cookies.get(REFRESH_TOKEN_COOKIE_NAME)

    first_refresh = client.post("/auth/refresh")
    assert first_refresh.status_code == 200, first_refresh.text

    # Reusing the now-rotated-out original refresh token must fail.
    client.cookies.set(REFRESH_TOKEN_COOKIE_NAME, original_refresh_token)
    reuse = client.post("/auth/refresh")
    assert reuse.status_code == 400, reuse.text
    assert reuse.json()["code"] == "INVALID_TOKEN"


def test_refresh_rejects_unknown_token(client):
    client.cookies.set(REFRESH_TOKEN_COOKIE_NAME, "not-a-real-token")
    res = client.post("/auth/refresh")
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "INVALID_TOKEN"


def test_refresh_rejects_missing_token(client):
    res = client.post("/auth/refresh")
    assert res.status_code == 401, res.text


def test_refresh_rejects_expired_token(client):
    _register(client)
    raw_refresh_token = client.cookies.get(REFRESH_TOKEN_COOKIE_NAME)

    with Session(engine) as session:
        from sqlmodel import select
        import hashlib

        hashed = hashlib.sha256(raw_refresh_token.encode("utf-8")).hexdigest()
        record = session.exec(select(RefreshToken).where(RefreshToken.token == hashed)).first()
        assert record is not None
        from datetime import datetime, timedelta, timezone

        record.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        session.add(record)
        session.commit()

    res = client.post("/auth/refresh")
    assert res.status_code == 410, res.text
    assert res.json()["code"] == "LINK_EXPIRED"


def test_logout_revokes_the_refresh_token_and_clears_cookies(client):
    _register(client)
    csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
    logout = client.post("/auth/logout", headers={"X-CSRF-Token": csrf_token})
    assert logout.status_code == 204, logout.text
    assert not client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    assert not client.cookies.get(REFRESH_TOKEN_COOKIE_NAME)

    res = client.post("/auth/refresh")
    assert res.status_code == 401, res.text


def test_logout_with_no_cookie_is_a_no_op(client):
    """Logout shouldn't error just because there's no session to revoke."""
    res = client.post("/auth/logout")
    assert res.status_code == 204, res.text
