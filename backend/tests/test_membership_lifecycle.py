"""
Leaving a workspace, transferring ownership, and the read-only rule for a
workspace a superadmin has suspended (is_active = False).
"""

import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import AuditLog, Blog, BlogMember, BlogRole, User
from app.models.blog import OnboardingStatus
from app.models.notification import Notification


def _register(client) -> tuple[dict, int, int]:
    """Returns (auth headers, user_id, blog_id), onboarding done and email verified."""
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": uuid.uuid4().hex[:6],
            "email": f"user-{uuid.uuid4().hex[:12]}@example.com",
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    user_id, blog_id = body["user"]["id"], body["user"]["blog_memberships"][0]["blog_id"]
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.email_verified = True
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(user)
        session.add(blog)
        session.commit()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, user_id, blog_id


def _join(user_id: int, blog_id: int, role: BlogRole) -> int:
    with Session(engine) as session:
        member = BlogMember(user_id=user_id, blog_id=blog_id, role=role)
        session.add(member)
        session.commit()
        return member.id


def _role(user_id: int, blog_id: int):
    with Session(engine) as session:
        m = session.exec(select(BlogMember).where(BlogMember.user_id == user_id, BlogMember.blog_id == blog_id)).first()
        return m.role if m else None


def _suspend(blog_id: int) -> None:
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.is_active = False
        session.add(blog)
        session.commit()


# ── Leaving ───────────────────────────────────────────────────────────────────

def test_editor_can_leave_and_the_owner_is_told(client):
    _, owner_id, blog_id = _register(client)
    member_headers, member_id, _ = _register(client)
    _join(member_id, blog_id, BlogRole.EDITOR)

    res = client.delete(f"/blogs/{blog_id}/members/me", headers=member_headers)

    assert res.status_code == 204, res.text
    assert _role(member_id, blog_id) is None
    with Session(engine) as session:
        note = session.exec(
            select(Notification).where(Notification.user_id == owner_id, Notification.type == "member_left")
        ).first()
        assert note is not None and note.blog_id == blog_id
        assert session.exec(
            select(AuditLog).where(AuditLog.action == "blog.member_leave", AuditLog.blog_id == blog_id)
        ).first() is not None


def test_author_can_leave(client):
    _, _, blog_id = _register(client)
    member_headers, member_id, _ = _register(client)
    _join(member_id, blog_id, BlogRole.AUTHOR)

    assert client.delete(f"/blogs/{blog_id}/members/me", headers=member_headers).status_code == 204
    assert _role(member_id, blog_id) is None


def test_owner_cannot_leave(client):
    owner_headers, owner_id, blog_id = _register(client)

    res = client.delete(f"/blogs/{blog_id}/members/me", headers=owner_headers)

    assert res.status_code == 400, res.text
    assert "owner" in res.json()["detail"]
    assert _role(owner_id, blog_id) == BlogRole.OWNER


def test_leaving_a_workspace_you_are_not_in_is_refused(client):
    _, _, blog_id = _register(client)
    outsider_headers, _, _ = _register(client)

    assert client.delete(f"/blogs/{blog_id}/members/me", headers=outsider_headers).status_code == 403


# ── Ownership transfer ────────────────────────────────────────────────────────

def test_owner_can_transfer_ownership_to_a_member(client):
    owner_headers, owner_id, blog_id = _register(client)
    _, member_id, _ = _register(client)
    membership_id = _join(member_id, blog_id, BlogRole.AUTHOR)

    res = client.post(f"/blogs/{blog_id}/transfer-ownership", json={"member_id": membership_id}, headers=owner_headers)

    assert res.status_code == 200, res.text
    assert _role(member_id, blog_id) == BlogRole.OWNER
    assert _role(owner_id, blog_id) == BlogRole.EDITOR
    with Session(engine) as session:
        assert session.get(Blog, blog_id).owner_id == member_id
        assert session.exec(
            select(Notification).where(Notification.user_id == member_id, Notification.type == "ownership_transferred")
        ).first() is not None


def test_previous_owner_can_leave_after_transferring(client):
    owner_headers, owner_id, blog_id = _register(client)
    _, member_id, _ = _register(client)
    membership_id = _join(member_id, blog_id, BlogRole.EDITOR)
    client.post(f"/blogs/{blog_id}/transfer-ownership", json={"member_id": membership_id}, headers=owner_headers)

    assert client.delete(f"/blogs/{blog_id}/members/me", headers=owner_headers).status_code == 204
    assert _role(owner_id, blog_id) is None


def test_only_the_owner_can_transfer(client):
    _, _, blog_id = _register(client)
    editor_headers, editor_id, _ = _register(client)
    _join(editor_id, blog_id, BlogRole.EDITOR)
    _, other_id, _ = _register(client)
    other_membership = _join(other_id, blog_id, BlogRole.AUTHOR)

    res = client.post(f"/blogs/{blog_id}/transfer-ownership", json={"member_id": other_membership}, headers=editor_headers)

    assert res.status_code == 403, res.text
    assert _role(other_id, blog_id) == BlogRole.AUTHOR


def test_transfer_to_a_member_of_another_workspace_is_404(client):
    owner_headers, _, blog_id = _register(client)
    _, _, other_blog_id = _register(client)
    with Session(engine) as session:
        foreign = session.exec(select(BlogMember).where(BlogMember.blog_id == other_blog_id)).first().id

    res = client.post(f"/blogs/{blog_id}/transfer-ownership", json={"member_id": foreign}, headers=owner_headers)

    assert res.status_code == 404, res.text


def test_transfer_respects_the_new_owners_workspace_cap(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MAX_OWNED_WORKSPACES", 1)
    owner_headers, _, blog_id = _register(client)
    _, member_id, _ = _register(client)  # already owns one: at the cap
    membership_id = _join(member_id, blog_id, BlogRole.EDITOR)

    res = client.post(f"/blogs/{blog_id}/transfer-ownership", json={"member_id": membership_id}, headers=owner_headers)

    assert res.status_code == 403, res.text
    assert res.json()["code"] == "WORKSPACE_LIMIT_REACHED"
    assert _role(member_id, blog_id) == BlogRole.EDITOR


# ── Suspended (deactivated) workspaces are read-only ─────────────────────────

def test_suspended_workspace_is_readable(client):
    headers, _, blog_id = _register(client)
    _suspend(blog_id)

    assert client.get(f"/blogs/{blog_id}/settings/general", headers=headers).status_code == 200


def test_suspended_workspace_refuses_writes(client):
    headers, _, blog_id = _register(client)
    _suspend(blog_id)

    res = client.post(f"/blogs/{blog_id}/tags/", json={"name": "blocked"}, headers=headers)

    assert res.status_code == 403, res.text
    assert res.json()["code"] == "WORKSPACE_DEACTIVATED"


def test_member_can_still_leave_a_suspended_workspace(client):
    _, _, blog_id = _register(client)
    member_headers, member_id, _ = _register(client)
    _join(member_id, blog_id, BlogRole.AUTHOR)
    _suspend(blog_id)

    assert client.delete(f"/blogs/{blog_id}/members/me", headers=member_headers).status_code == 204


def test_billing_is_not_blocked_by_suspension(client):
    headers, _, blog_id = _register(client)
    _suspend(blog_id)

    res = client.post(f"/blogs/{blog_id}/billing/cancel", headers=headers)

    # Whatever billing itself says (e.g. nothing to cancel on Free), it isn't the suspension.
    assert res.json().get("code") != "WORKSPACE_DEACTIVATED", res.text


def test_superadmin_can_write_to_a_suspended_workspace(client):
    _, _, blog_id = _register(client)
    admin_headers, admin_id, _ = _register(client)
    with Session(engine) as session:
        admin = session.get(User, admin_id)
        admin.is_super_admin = True
        session.add(admin)
        session.commit()
    _suspend(blog_id)

    res = client.post(f"/blogs/{blog_id}/tags/", json={"name": f"ok-{uuid.uuid4().hex[:4]}"}, headers=admin_headers)

    assert res.json().get("code") != "WORKSPACE_DEACTIVATED", res.text


def test_suspended_workspace_is_hidden_from_the_public(client):
    _, _, blog_id = _register(client)
    _suspend(blog_id)
    client.cookies.clear()

    assert client.get(f"/blogs/{blog_id}/settings/general").status_code == 404
    assert client.get(f"/blogs/{blog_id}/posts").status_code == 404


def test_members_can_still_read_posts_and_tags_of_a_suspended_workspace(client):
    _, _, blog_id = _register(client)
    member_headers, member_id, _ = _register(client)
    _join(member_id, blog_id, BlogRole.AUTHOR)
    _suspend(blog_id)
    client.cookies.clear()

    assert client.get(f"/blogs/{blog_id}/posts", headers=member_headers).status_code == 200
    assert client.get(f"/blogs/{blog_id}/tags/", headers=member_headers).status_code == 200


def test_non_members_cannot_read_a_suspended_workspace(client):
    _, _, blog_id = _register(client)
    outsider_headers, _, _ = _register(client)
    _suspend(blog_id)

    assert client.get(f"/blogs/{blog_id}/posts", headers=outsider_headers).status_code == 404


# ── One owner: role edits can't grant or remove ownership ─────────────────────

def test_role_edit_cannot_make_a_second_owner(client):
    owner_headers, _, blog_id = _register(client)
    _, member_id, _ = _register(client)
    membership_id = _join(member_id, blog_id, BlogRole.EDITOR)

    res = client.patch(f"/blogs/{blog_id}/members/{membership_id}", json={"role": "owner"}, headers=owner_headers)

    assert res.status_code == 400, res.text
    assert "Make owner" in res.json()["detail"]
    assert _role(member_id, blog_id) == BlogRole.EDITOR


def test_role_edit_cannot_demote_the_owner(client):
    owner_headers, owner_id, blog_id = _register(client)
    with Session(engine) as session:
        own = session.exec(select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == owner_id)).first().id

    res = client.patch(f"/blogs/{blog_id}/members/{own}", json={"role": "editor"}, headers=owner_headers)

    assert res.status_code == 400, res.text
    assert _role(owner_id, blog_id) == BlogRole.OWNER


def test_role_edit_between_editor_and_author_still_works(client):
    owner_headers, _, blog_id = _register(client)
    _, member_id, _ = _register(client)
    membership_id = _join(member_id, blog_id, BlogRole.AUTHOR)

    res = client.patch(f"/blogs/{blog_id}/members/{membership_id}", json={"role": "editor"}, headers=owner_headers)

    assert res.status_code == 200, res.text
    assert _role(member_id, blog_id) == BlogRole.EDITOR
