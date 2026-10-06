"""
Coverage for brute-force throttling on POST /auth/login: per-account and
per-IP failed-attempt limits (see app/services/login_throttle.py).

Each test uses a distinct fake X-Forwarded-For IP. The test database is
session-scoped and shared across every test module, and TestClient's real
socket peer is always "testclient" — using distinct fake IPs (which
get_client_ip() prefers over the socket peer) keeps these tests isolated
from each other and from unrelated login tests elsewhere in the suite.
"""

import itertools
import uuid

import pytest
from starlette.requests import Request

from app.core.audit import get_client_ip

_ip_counter = itertools.count(1)


def _fake_ip() -> str:
    return f"203.0.113.{next(_ip_counter) % 254 + 1}"


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client, ip: str) -> dict:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": _unique_email(),
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
        headers={"X-Forwarded-For": ip},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _login(client, email: str, password: str, ip: str):
    return client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"X-Forwarded-For": ip},
    )


def test_account_locks_out_after_max_failed_attempts(client):
    ip = _fake_ip()
    user = _register(client, ip)
    email = user["user"]["email"]

    for _ in range(5):
        res = _login(client, email, "wrongpassword1", ip)
        assert res.status_code == 400, res.text

    blocked = _login(client, email, "wrongpassword1", ip)
    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["code"] == "RATE_LIMITED"
    assert "Retry-After" in blocked.headers

    # Even the *correct* password is blocked once the account is throttled.
    still_blocked = _login(client, email, "correcthorse1", ip)
    assert still_blocked.status_code == 429, still_blocked.text


def test_correct_login_still_works_below_threshold(client):
    ip = _fake_ip()
    user = _register(client, ip)
    email = user["user"]["email"]

    for _ in range(4):
        res = _login(client, email, "wrongpassword1", ip)
        assert res.status_code == 400, res.text

    ok = _login(client, email, "correcthorse1", ip)
    assert ok.status_code == 200, ok.text


def test_ip_locks_out_across_many_distinct_identifiers(client):
    ip = _fake_ip()

    for _ in range(20):
        res = _login(client, _unique_email(), "wrongpassword1", ip)
        assert res.status_code == 400, res.text

    blocked = _login(client, _unique_email(), "wrongpassword1", ip)
    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["code"] == "RATE_LIMITED"


def test_spoofed_forwarded_for_entries_cannot_dodge_the_ip_limit(client):
    """
    A client can prepend anything to X-Forwarded-For; only the entry our own
    proxy appended (right-most, with the default one trusted hop) counts. Fresh
    fake entries on every attempt must not reset the per-IP budget.
    """
    real_ip = _fake_ip()

    for i in range(20):
        res = _login(client, _unique_email(), "wrongpassword1", f"198.51.100.{i + 1}, {real_ip}")
        assert res.status_code == 400, res.text

    blocked = _login(client, _unique_email(), "wrongpassword1", f"198.51.100.250, {real_ip}")
    assert blocked.status_code == 429, blocked.text
    assert blocked.json()["code"] == "RATE_LIMITED"


@pytest.mark.parametrize(
    ("forwarded_for", "hops", "expected"),
    [
        ("203.0.113.7", 1, "203.0.113.7"),
        ("1.2.3.4, 203.0.113.7", 1, "203.0.113.7"),
        ("1.2.3.4, 203.0.113.7, 10.0.0.2", 2, "203.0.113.7"),
        ("203.0.113.7", 3, "203.0.113.7"),
        ("1.2.3.4", 0, "testclient"),
        (None, 1, "testclient"),
    ],
)
def test_get_client_ip_trusts_only_proxy_appended_entries(forwarded_for, hops, expected):
    headers = [(b"x-forwarded-for", forwarded_for.encode())] if forwarded_for else []
    request = Request({"type": "http", "headers": headers, "client": ("testclient", 50000)})
    assert get_client_ip(request, trusted_hops=hops) == expected


def test_ip_lockout_does_not_affect_a_different_source_ip(client):
    ip_a = _fake_ip()
    ip_b = _fake_ip()

    for _ in range(20):
        _login(client, _unique_email(), "wrongpassword1", ip_a)

    blocked = _login(client, _unique_email(), "wrongpassword1", ip_a)
    assert blocked.status_code == 429, blocked.text

    user = _register(client, ip_b)
    email = user["user"]["email"]
    ok = _login(client, email, "correcthorse1", ip_b)
    assert ok.status_code == 200, ok.text
