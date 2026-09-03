"""
Coverage for the actual promotion logic the post scheduler runs every 60
seconds — previously exercised only implicitly (never called directly, and
never asserted against) despite being a real, load-bearing background job.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.db import engine
from app.core.scheduler import publish_scheduled_posts
from app.models import AuditLog, Notification, Post
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
    return body["access_token"], body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _create_scheduled_post(blog_id: int, author_id: int, published_at: datetime) -> int:
    with Session(engine) as session:
        post = Post(
            title=f"Scheduled {uuid.uuid4().hex[:8]}",
            slug=f"scheduled-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            status=PostStatus.SCHEDULED,
            published=False,
            published_at=published_at,
        )
        session.add(post)
        session.commit()
        session.refresh(post)
        return post.id


def test_publish_scheduled_posts_promotes_due_posts(client):
    _, blog_id, user_id = _register_owner(client)
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    post_id = _create_scheduled_post(blog_id, user_id, past)

    publish_scheduled_posts()

    with Session(engine) as session:
        post = session.get(Post, post_id)
        assert post.status == PostStatus.PUBLISHED
        assert post.published is True

        audit = session.exec(
            select(AuditLog).where(
                AuditLog.action == "post.published",
                AuditLog.resource_id == post_id,
            )
        ).first()
        assert audit is not None
        assert audit.actor_user_id is None  # system action, no human actor


def test_publish_scheduled_posts_notifies_the_author(client):
    _, blog_id, user_id = _register_owner(client)
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    post_id = _create_scheduled_post(blog_id, user_id, past)

    publish_scheduled_posts()

    with Session(engine) as session:
        post = session.get(Post, post_id)
        notification = session.exec(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == "post_published",
            )
        ).first()
        assert notification is not None
        assert post.title in notification.title
        assert notification.blog_id == blog_id
        assert notification.link == f"/admin/posts/view/{post_id}?blog={blog_id}"


def test_publish_scheduled_posts_leaves_future_posts_alone(client):
    _, blog_id, user_id = _register_owner(client)
    future = datetime.now(timezone.utc) + timedelta(days=1)
    post_id = _create_scheduled_post(blog_id, user_id, future)

    publish_scheduled_posts()

    with Session(engine) as session:
        post = session.get(Post, post_id)
        assert post.status == PostStatus.SCHEDULED
        assert post.published is False

        notification = session.exec(
            select(Notification).where(Notification.user_id == user_id)
        ).first()
        assert notification is None


def test_publish_scheduled_posts_is_a_no_op_with_nothing_due(client):
    """Guards against the early-return branch raising when due_posts is empty."""
    publish_scheduled_posts()
