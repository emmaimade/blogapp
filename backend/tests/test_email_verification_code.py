"""
Signup verification by code: the verification email carries a 6-digit code
(and the old link), the studio asks for the code before anything else, and a
mistyped signup address can be corrected while it's still unverified.
"""

import uuid
from datetime import timedelta

import pytest
from sqlmodel import Session, select

from app.core.datetimes import utc_now
from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import User
from app.models.auth_tokens import EmailVerification


@pytest.fixture
def sent(monkeypatch):
    """Captures outgoing emails instead of dropping them."""
    outbox: list[dict] = []
    monkeypatch.setattr(
        "app.core.email.send_smtp_email",
        lambda to, subject, html, text: outbox.append({"to": to, "subject": subject, "html": html, "text": text}),
    )
    return outbox


@pytest.fixture
def codes(monkeypatch):
    """Makes the codes predictable: 100001, 100002, …"""
    issued: list[str] = []

    def next_code() -> str:
        issued.append(str(100001 + len(issued)))
        return issued[-1]

    monkeypatch.setattr("app.services.auth_tokens.generate_verification_code", next_code)
    return issued


def _register(client) -> tuple[dict, int, str]:
    email = f"user-{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": email,
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, resp.json()["user"]["id"], email


def _verify(client, headers, code: str):
    return client.post("/auth/verify-email-code", json={"code": code}, headers=headers)


def _is_verified(user_id: int) -> bool:
    with Session(engine) as session:
        return session.get(User, user_id).email_verified


def _age_latest_record(user_id: int, minutes: int) -> None:
    with Session(engine) as session:
        record = session.exec(
            select(EmailVerification).where(EmailVerification.user_id == user_id)
        ).first()
        record.created_at = utc_now() - timedelta(minutes=minutes)
        session.add(record)
        session.commit()


def test_signup_email_carries_the_code_and_the_link(client, sent, codes):
    _, _, email = _register(client)

    assert len(sent) == 1
    message = sent[0]
    assert message["to"] == email
    assert codes[0] in message["subject"]
    assert codes[0] in message["html"] and codes[0] in message["text"]
    assert "/verify-email?token=" in message["text"]


def test_the_right_code_verifies_the_account(client, sent, codes):
    headers, user_id, _ = _register(client)

    resp = _verify(client, headers, codes[0])

    assert resp.status_code == 200, resp.text
    assert resp.json()["already_verified"] is False
    assert _is_verified(user_id)
    assert client.get("/auth/me", headers=headers).json()["email_verified"] is True


def test_a_wrong_code_says_how_many_tries_are_left(client, sent, codes):
    headers, user_id, _ = _register(client)

    resp = _verify(client, headers, "000000")

    assert resp.status_code == 400
    assert resp.json()["code"] == "VERIFICATION_CODE_INVALID"
    assert "4 tries left" in resp.json()["message"]
    assert not _is_verified(user_id)


def test_five_wrong_codes_lock_the_code_even_against_the_right_one(client, sent, codes):
    headers, user_id, _ = _register(client)

    for _ in range(4):
        assert _verify(client, headers, "000000").json()["code"] == "VERIFICATION_CODE_INVALID"
    assert _verify(client, headers, "000000").json()["code"] == "VERIFICATION_CODE_LOCKED"

    resp = _verify(client, headers, codes[0])
    assert resp.json()["code"] == "VERIFICATION_CODE_LOCKED"
    assert not _is_verified(user_id)


def test_an_expired_code_is_refused(client, sent, codes):
    headers, user_id, _ = _register(client)
    _age_latest_record(user_id, minutes=16)

    resp = _verify(client, headers, codes[0])

    assert resp.json()["code"] == "VERIFICATION_CODE_EXPIRED"
    assert not _is_verified(user_id)


def test_resending_replaces_the_code(client, sent, codes):
    headers, user_id, email = _register(client)
    _age_latest_record(user_id, minutes=2)  # past the resend cooldown

    resend = client.post("/auth/send-verification", json={"email": email}, headers=headers)
    assert resend.status_code == 200, resend.text

    assert _verify(client, headers, codes[0]).json()["code"] == "VERIFICATION_CODE_INVALID"
    assert _verify(client, headers, codes[1]).status_code == 200
    assert _is_verified(user_id)


def test_resending_too_soon_is_rate_limited(client, sent, codes):
    headers, _, email = _register(client)

    resp = client.post("/auth/send-verification", json={"email": email}, headers=headers)

    assert resp.status_code == 429


def test_malformed_codes_are_rejected_without_using_a_try(client, sent, codes):
    headers, user_id, _ = _register(client)

    assert _verify(client, headers, "12345").status_code == 422
    assert _verify(client, headers, "12a456").status_code == 422
    with Session(engine) as session:
        record = session.exec(select(EmailVerification).where(EmailVerification.user_id == user_id)).first()
        assert record.code_attempts == 0


def test_verifying_needs_a_signed_in_user(client, sent, codes):
    _register(client)
    client.cookies.clear()

    assert client.post("/auth/verify-email-code", json={"code": codes[0]}).status_code == 401


def test_the_link_in_the_same_email_still_verifies(client, sent, codes):
    _, user_id, _ = _register(client)
    token = sent[0]["text"].split("/verify-email?token=")[1].split()[0]

    resp = client.get("/auth/verify-email", params={"token": token})

    assert resp.status_code == 200, resp.text
    assert _is_verified(user_id)


def test_a_mistyped_email_can_be_changed_and_gets_a_new_code(client, sent, codes):
    headers, user_id, _ = _register(client)
    _age_latest_record(user_id, minutes=2)
    new_email = f"fixed-{uuid.uuid4().hex[:8]}@example.com"

    resp = client.put("/auth/email", json={"email": new_email}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert sent[-1]["to"] == new_email and codes[1] in sent[-1]["subject"]
    assert _verify(client, headers, codes[1]).status_code == 200
    with Session(engine) as session:
        user = session.get(User, user_id)
        assert user.email == new_email and user.email_verified


def test_changing_email_respects_the_resend_cooldown(client, sent, codes):
    headers, user_id, email = _register(client)

    resp = client.put("/auth/email", json={"email": f"other-{uuid.uuid4().hex[:8]}@example.com"}, headers=headers)

    assert resp.status_code == 429
    with Session(engine) as session:
        assert session.get(User, user_id).email == email


def test_cannot_change_to_an_email_another_account_uses(client, sent, codes):
    _, _, taken_email = _register(client)
    headers, user_id, _ = _register(client)
    _age_latest_record(user_id, minutes=2)

    resp = client.put("/auth/email", json={"email": taken_email.upper()}, headers=headers)

    assert resp.status_code == 409
    assert resp.json()["code"] == "EMAIL_ALREADY_EXISTS"


def test_a_verified_email_cannot_be_changed_here(client, sent, codes):
    headers, _, _ = _register(client)
    assert _verify(client, headers, codes[0]).status_code == 200

    resp = client.put("/auth/email", json={"email": f"x-{uuid.uuid4().hex[:8]}@example.com"}, headers=headers)

    assert resp.status_code == 409
    assert resp.json()["code"] == "EMAIL_ALREADY_VERIFIED"
