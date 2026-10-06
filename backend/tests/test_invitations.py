"""
Coverage for the invitation accept flow — both the existing-user path
(POST /invitations/{token}/accept) and the brand-new-account path
(POST /invitations/{token}/register-and-accept), including the guard cases
(expired, already accepted, wrong email, already a member) that had no
automated coverage despite gating a real security boundary.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import BlogInvitation, BlogRole


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client, email: str | None = None) -> tuple[str, int, int]:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": email or _unique_email(),
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return client.cookies.get(ACCESS_TOKEN_COOKIE_NAME), body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _create_invitation(
    blog_id: int,
    email: str,
    created_by: int,
    role: BlogRole = BlogRole.EDITOR,
    expires_in: timedelta = timedelta(days=7),
    accepted_at=None,
) -> str:
    token = uuid.uuid4().hex
    with Session(engine) as session:
        session.add(
            BlogInvitation(
                blog_id=blog_id,
                email=email,
                role=role,
                token=token,
                created_by=created_by,
                expires_at=datetime.now(timezone.utc) + expires_in,
                accepted_at=accepted_at,
            )
        )
        session.commit()
    return token


# ── accept_invitation (existing user) ────────────────────────────────────────

def test_accept_invitation_happy_path_creates_membership(client):
    owner_token, blog_id, owner_id = _register(client)
    invitee_email = _unique_email()
    invitee_token, invitee_blog_id, invitee_id = _register(client, invitee_email)

    token = _create_invitation(blog_id, invitee_email, owner_id, role=BlogRole.EDITOR)

    res = client.post(f"/invitations/{token}/accept", headers={"Authorization": f"Bearer {invitee_token}"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["blog_id"] == blog_id
    assert body["role"] == "editor"
    assert body["user_id"] == invitee_id
    # The invitee still owns their own separate workspace from registration —
    # accepting an invite adds a membership, it doesn't touch that.
    assert invitee_blog_id != blog_id


def test_accept_invitation_rejects_wrong_email(client):
    owner_token, blog_id, owner_id = _register(client)
    invitee_token, _, _ = _register(client)  # different email than the invite

    token = _create_invitation(blog_id, _unique_email(), owner_id)

    res = client.post(f"/invitations/{token}/accept", headers={"Authorization": f"Bearer {invitee_token}"})
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "FORBIDDEN"


def test_accept_invitation_rejects_expired(client):
    owner_token, blog_id, owner_id = _register(client)
    invitee_email = _unique_email()
    invitee_token, _, _ = _register(client, invitee_email)

    token = _create_invitation(blog_id, invitee_email, owner_id, expires_in=timedelta(days=-1))

    res = client.post(f"/invitations/{token}/accept", headers={"Authorization": f"Bearer {invitee_token}"})
    assert res.status_code == 410, res.text
    assert res.json()["code"] == "INVITATION_EXPIRED"


def test_accept_invitation_rejects_already_accepted(client):
    owner_token, blog_id, owner_id = _register(client)
    invitee_email = _unique_email()
    invitee_token, _, _ = _register(client, invitee_email)

    token = _create_invitation(
        blog_id, invitee_email, owner_id, accepted_at=datetime.now(timezone.utc)
    )

    res = client.post(f"/invitations/{token}/accept", headers={"Authorization": f"Bearer {invitee_token}"})
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "INVITATION_ALREADY_ACCEPTED"


def test_accept_invitation_rejects_if_already_a_member(client):
    owner_token, blog_id, owner_id = _register(client)
    invitee_email = _unique_email()
    invitee_token, _, _ = _register(client, invitee_email)

    first_invite = _create_invitation(blog_id, invitee_email, owner_id)
    accept = client.post(f"/invitations/{first_invite}/accept", headers={"Authorization": f"Bearer {invitee_token}"})
    assert accept.status_code == 200, accept.text

    second_invite = _create_invitation(blog_id, invitee_email, owner_id)
    res = client.post(f"/invitations/{second_invite}/accept", headers={"Authorization": f"Bearer {invitee_token}"})
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "ALREADY_A_MEMBER"


# ── register_and_accept_invitation (brand-new account) ───────────────────────

def test_register_and_accept_creates_one_membership_in_existing_blog(client):
    owner_token, blog_id, owner_id = _register(client)
    new_email = _unique_email()
    token = _create_invitation(blog_id, new_email, owner_id, role=BlogRole.AUTHOR)

    res = client.post(
        f"/invitations/{token}/register-and-accept",
        json={"first_name": "New", "last_name": "Teammate", "password": "correcthorse1"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    memberships = body["user"]["blog_memberships"]
    assert len(memberships) == 1
    assert memberships[0]["blog_id"] == blog_id
    assert memberships[0]["role"] == "author"


def test_register_and_accept_rejects_expired(client):
    owner_token, blog_id, owner_id = _register(client)
    token = _create_invitation(blog_id, _unique_email(), owner_id, expires_in=timedelta(days=-1))

    res = client.post(
        f"/invitations/{token}/register-and-accept",
        json={"first_name": "New", "last_name": "Teammate", "password": "correcthorse1"},
    )
    assert res.status_code == 410, res.text
    assert res.json()["code"] == "INVITATION_EXPIRED"


def test_register_and_accept_rejects_already_accepted(client):
    owner_token, blog_id, owner_id = _register(client)
    token = _create_invitation(
        blog_id, _unique_email(), owner_id, accepted_at=datetime.now(timezone.utc)
    )

    res = client.post(
        f"/invitations/{token}/register-and-accept",
        json={"first_name": "New", "last_name": "Teammate", "password": "correcthorse1"},
    )
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "INVITATION_ALREADY_ACCEPTED"


def test_register_and_accept_rejects_existing_email(client):
    owner_token, blog_id, owner_id = _register(client)
    existing_email = _unique_email()
    _register(client, existing_email)  # account already exists with this email

    token = _create_invitation(blog_id, existing_email, owner_id)

    res = client.post(
        f"/invitations/{token}/register-and-accept",
        json={"first_name": "New", "last_name": "Teammate", "password": "correcthorse1"},
    )
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "EMAIL_ALREADY_EXISTS"
