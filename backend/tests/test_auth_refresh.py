"""
Coverage for JWT refresh/logout/revocation: login returns a refresh token
alongside the access token, /auth/refresh rotates it (old token rejected on
reuse), and /auth/logout revokes it outright.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
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


def test_login_response_includes_a_refresh_token(client):
    body = _register(client)
    assert "refresh_token" in body
    assert isinstance(body["refresh_token"], str) and body["refresh_token"]


def test_refresh_issues_a_new_access_token(client):
    body = _register(client)
    res = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert res.status_code == 200, res.text
    new_body = res.json()
    assert new_body["access_token"]
    assert new_body["refresh_token"]
    # The refresh token always rotates (a fresh random value each time);
    # the access token's byte content isn't asserted here since it has no
    # jti/iat and can be identical to the prior one if minted in the same
    # second — its *usability* is what's asserted below instead.
    assert new_body["refresh_token"] != body["refresh_token"]

    # The new access token is actually usable.
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {new_body['access_token']}"})
    assert me.status_code == 200, me.text


def test_refresh_rotates_and_rejects_reuse_of_the_old_token(client):
    body = _register(client)
    first_refresh = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert first_refresh.status_code == 200, first_refresh.text

    # Reusing the now-rotated-out original refresh token must fail.
    reuse = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert reuse.status_code == 400, reuse.text
    assert reuse.json()["code"] == "INVALID_TOKEN"

    # The newly-issued refresh token from the first call still works.
    second_refresh = client.post(
        "/auth/refresh", json={"refresh_token": first_refresh.json()["refresh_token"]}
    )
    assert second_refresh.status_code == 200, second_refresh.text


def test_refresh_rejects_unknown_token(client):
    res = client.post("/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "INVALID_TOKEN"


def test_refresh_rejects_expired_token(client):
    body = _register(client)
    with Session(engine) as session:
        from sqlmodel import select
        import hashlib

        hashed = hashlib.sha256(body["refresh_token"].encode("utf-8")).hexdigest()
        record = session.exec(select(RefreshToken).where(RefreshToken.token == hashed)).first()
        assert record is not None
        from datetime import datetime, timedelta, timezone

        record.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        session.add(record)
        session.commit()

    res = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert res.status_code == 410, res.text
    assert res.json()["code"] == "LINK_EXPIRED"


def test_logout_revokes_the_refresh_token(client):
    body = _register(client)
    logout = client.post("/auth/logout", json={"refresh_token": body["refresh_token"]})
    assert logout.status_code == 204, logout.text

    res = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "INVALID_TOKEN"


def test_logout_with_unknown_token_is_a_no_op(client):
    """Logout shouldn't error just because the token is already gone/invalid."""
    res = client.post("/auth/logout", json={"refresh_token": "not-a-real-token"})
    assert res.status_code == 204, res.text
