"""
Coverage for the flag → moderate flow: flagging a post/comment creates a
pending ModerationItem (deduped on re-flag), and a superadmin's
approve/reject/remove actions resolve it — with "remove" actually mutating
the underlying content.
"""

import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Post, User
from app.models.post import PostStatus


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[str, int, int]:
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
    body = resp.json()
    return client.cookies.get(ACCESS_TOKEN_COOKIE_NAME), body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _promote_to_superadmin(email: str):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        user.is_super_admin = True
        session.add(user)
        session.commit()


def _superadmin_headers(client) -> dict:
    admin_email = _unique_email()
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Super",
            "last_name": "Admin",
            "email": admin_email,
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    _promote_to_superadmin(admin_email)
    login = client.post(
        "/users/login",
        data={"username": admin_email, "password": "correcthorse1"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}


def _create_post(blog_id: int, author_id: int) -> int:
    with Session(engine) as session:
        post = Post(
            title=f"Post {uuid.uuid4().hex[:8]}",
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            status=PostStatus.PUBLISHED,
            published=True,
        )
        session.add(post)
        session.commit()
        session.refresh(post)
        return post.id


def test_flag_post_creates_pending_moderation_item(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    res = client.post(
        f"/blogs/{blog_id}/posts/{post_id}/flag",
        json={"reason": "spam", "notes": "looks like spam"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["item_type"] == "post"
    assert body["content_id"] == post_id
    assert body["status"] == "pending"
    assert body["reason"] == "spam"


def test_reflagging_same_post_updates_existing_item_not_duplicate(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    first = client.post(
        f"/blogs/{blog_id}/posts/{post_id}/flag",
        json={"reason": "spam"},
        headers=headers,
    )
    second = client.post(
        f"/blogs/{blog_id}/posts/{post_id}/flag",
        json={"reason": "harassment"},
        headers=headers,
    )
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["reason"] == "harassment"

    admin_headers = _superadmin_headers(client)
    queue = client.get("/superadmin/moderation?content_type=post", headers=admin_headers)
    assert queue.status_code == 200, queue.text
    matches = [item for item in queue.json() if item["content_id"] == post_id]
    assert len(matches) == 1


def test_flag_comment_creates_pending_moderation_item(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    comment = client.post(
        "/comments/", json={"content": "Nice post", "post_id": post_id}, headers=headers
    )
    assert comment.status_code == 200, comment.text
    comment_id = comment.json()["id"]

    res = client.post(
        f"/comments/{comment_id}/flag",
        json={"reason": "spam"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["item_type"] == "comment"
    assert body["content_id"] == comment_id
    assert body["status"] == "pending"


def test_superadmin_can_approve_a_flagged_post(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    flag = client.post(f"/blogs/{blog_id}/posts/{post_id}/flag", json={"reason": "spam"}, headers=headers)
    item_id = flag.json()["id"]

    admin_headers = _superadmin_headers(client)
    res = client.post(
        f"/superadmin/moderation/{item_id}/actions",
        json={"action": "approve"},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["action"] == "approve"

    queue = client.get("/superadmin/moderation?status=approved", headers=admin_headers)
    assert any(item["id"] == item_id for item in queue.json())


def test_superadmin_remove_action_soft_deletes_comment(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    comment = client.post(
        "/comments/", json={"content": "Nice post", "post_id": post_id}, headers=headers
    )
    comment_id = comment.json()["id"]

    flag = client.post(f"/comments/{comment_id}/flag", json={"reason": "abuse"}, headers=headers)
    item_id = flag.json()["id"]

    admin_headers = _superadmin_headers(client)
    res = client.post(
        f"/superadmin/moderation/{item_id}/actions",
        json={"action": "remove"},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["action"] == "remove"

    fetched = client.get(f"/comments/post/{post_id}")
    assert fetched.status_code == 200, fetched.text
    removed_comment = next(c for c in fetched.json()["items"] if c["id"] == comment_id)
    assert removed_comment["is_deleted"] is True
    assert "removed by a moderator" in removed_comment["content"]


def test_invalid_moderation_action_is_rejected(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    flag = client.post(f"/blogs/{blog_id}/posts/{post_id}/flag", json={"reason": "spam"}, headers=headers)
    item_id = flag.json()["id"]

    admin_headers = _superadmin_headers(client)
    res = client.post(
        f"/superadmin/moderation/{item_id}/actions",
        json={"action": "bogus"},
        headers=admin_headers,
    )
    assert res.status_code == 422, res.text
