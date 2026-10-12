"""
Account deletion end to end: owners of shared workspaces can't be deleted until
ownership moves on (superadmins can move it), restores stop at the retention
deadline, and the purge erases an account without taking other people's
content with it. Also the Vercel Cron endpoint that triggers the purge.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.core.tasks import purge_expired_soft_deleted_users
from app.models import Blog, BlogMember, Notification, Post, User
from app.models.blog import BlogRole


def _register(client, first_name="Ada") -> tuple[dict, int, int]:
    client.cookies.clear()
    resp = client.post(
        "/users/register",
        json={
            "first_name": first_name,
            "last_name": "Tester",
            "email": f"user-{uuid.uuid4().hex[:12]}@example.com",
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _superadmin(client) -> dict:
    headers, _, user_id = _register(client, "Admin")
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.is_super_admin = True
        session.add(user)
        session.commit()
    return headers


def _add_member(blog_id: int, user_id: int, role=BlogRole.EDITOR) -> int:
    with Session(engine) as session:
        member = BlogMember(blog_id=blog_id, user_id=user_id, role=role)
        session.add(member)
        session.commit()
        return member.id


def _backdate_deletion(user_id: int, days: int) -> None:
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.deleted_at = datetime.now(timezone.utc) - timedelta(days=days)
        user.is_active = False
        session.add(user)
        session.commit()


def test_owner_of_a_shared_workspace_cannot_be_deleted(client):
    owner_headers, blog_id, owner_id = _register(client, "Olu")
    _, _, editor_id = _register(client, "Eve")
    _add_member(blog_id, editor_id)
    admin = _superadmin(client)

    res = client.delete(f"/superadmin/users/{owner_id}", headers=admin)
    assert res.status_code == 400
    with Session(engine) as session:
        name = session.get(Blog, blog_id).name
    assert name in res.json()["message"] and "Transfer ownership" in res.json()["message"]

    own = client.delete("/users/me", headers=owner_headers)
    assert own.status_code == 400
    assert own.json()["message"].startswith("You still own a workspace")


def test_superadmin_can_transfer_ownership_then_delete(client):
    _, blog_id, owner_id = _register(client, "Olu")
    _, _, editor_id = _register(client, "Eve")
    member_id = _add_member(blog_id, editor_id)
    admin = _superadmin(client)

    res = client.post(f"/superadmin/blogs/{blog_id}/transfer-ownership", headers=admin, json={"member_id": member_id})
    assert res.status_code == 200, res.text
    assert res.json()["role"] == "owner"
    with Session(engine) as session:
        assert session.get(Blog, blog_id).owner_id == editor_id
        # The previous owner hears about it, since they didn't do it.
        note = session.exec(
            select(Notification).where(Notification.user_id == owner_id, Notification.type == "ownership_transferred")
        ).first()
        assert note is not None and "new owner" in note.title

    assert client.delete(f"/superadmin/users/{owner_id}", headers=admin).status_code == 204


def test_restore_is_refused_after_the_retention_window(client):
    _, _, user_id = _register(client)
    admin = _superadmin(client)
    _backdate_deletion(user_id, days=31)

    res = client.post(f"/superadmin/users/{user_id}/restore", headers=admin)
    assert res.status_code == 400
    assert "can no longer be restored" in res.json()["message"]


def test_purge_erases_the_account_but_keeps_its_posts_elsewhere(client):
    _, shared_blog_id, owner_id = _register(client, "Olu")
    _, solo_blog_id, writer_id = _register(client, "Wren")
    _add_member(shared_blog_id, writer_id)
    with Session(engine) as session:
        post = Post(title="Kept", slug=f"kept-{uuid.uuid4().hex[:6]}", content="Body", blog_id=shared_blog_id, author_id=writer_id)
        session.add(post)
        session.commit()
        post_id = post.id
    _backdate_deletion(writer_id, days=31)

    summary = purge_expired_soft_deleted_users()
    assert summary["failed"] == 0

    with Session(engine) as session:
        assert session.get(User, writer_id) is None
        # Their solo workspace goes; their membership elsewhere goes...
        assert session.get(Blog, solo_blog_id) is None
        assert session.exec(select(BlogMember).where(BlogMember.user_id == writer_id)).first() is None
        # ...but the post they wrote in someone else's workspace stays.
        kept = session.get(Post, post_id)
        assert kept is not None and kept.author_id is None
        assert session.get(User, owner_id) is not None


def test_purge_skips_accounts_that_still_own_a_shared_workspace(client):
    _, blog_id, owner_id = _register(client, "Olu")
    _, _, editor_id = _register(client, "Eve")
    _add_member(blog_id, editor_id)
    # Deleted before the ownership rule existed.
    _backdate_deletion(owner_id, days=31)

    purge_expired_soft_deleted_users()

    with Session(engine) as session:
        assert session.get(User, owner_id) is not None
        assert session.get(Blog, blog_id) is not None


def test_cron_endpoint_requires_the_secret(client, monkeypatch):
    path = "/internal/cron/purge-deleted-accounts"
    monkeypatch.setattr(settings, "CRON_SECRET", None)
    assert client.get(path).status_code == 404

    monkeypatch.setattr(settings, "CRON_SECRET", "s3cret")
    assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401
    res = client.get(path, headers={"Authorization": "Bearer s3cret"})
    assert res.status_code == 200
    assert set(res.json()) == {"purged", "skipped", "failed"}
