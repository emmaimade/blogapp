"""
GET /superadmin/blogs: each workspace's plan is the one its features follow
right now (a lapsed trial is Free), its stats are right, and the number of
queries doesn't grow with the number of workspaces.
"""

import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from sqlalchemy import event
from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import BlogSubscription, Post, SubscriptionPlan, User
from app.models.post import PostStatus


def _register(client) -> tuple[dict, int, int]:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
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
    headers, _, user_id = _register(client)
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.is_super_admin = True
        session.add(user)
        session.commit()
    return headers


def _set_subscription(blog_id: int, **fields) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        for key, value in fields.items():
            setattr(subscription, key, value)
        session.add(subscription)
        session.commit()


def _future(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def _rows(client, admin: dict) -> dict[int, dict]:
    res = client.get("/superadmin/blogs", headers=admin)
    assert res.status_code == 200, res.text
    return {row["blog_id"]: row for row in res.json()}


@contextmanager
def _count_queries():
    statements: list[str] = []

    def record(conn, cursor, statement, *args):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


def test_plan_is_the_effective_plan(client):
    admin = _superadmin(client)
    _, free, _ = _register(client)
    _, paying, _ = _register(client)
    _set_subscription(paying, plan=SubscriptionPlan.TEAM, status="active", current_period_ends_at=_future(20))
    _, trialing, _ = _register(client)
    _set_subscription(trialing, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=_future(5))
    _, expired_trial, _ = _register(client)
    _set_subscription(expired_trial, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=_future(-1))

    rows = _rows(client, admin)

    assert rows[free]["plan"] == "free"
    assert rows[paying]["plan"] == "team"
    assert rows[trialing]["plan"] == "pro"
    assert rows[expired_trial]["plan"] == "free"


def test_stats_count_posts_views_and_members(client):
    admin = _superadmin(client)
    _, blog_id, owner_id = _register(client)
    before = _rows(client, admin)[blog_id]

    with Session(engine) as session:
        for views in (10, 25):
            title = f"Post {uuid.uuid4().hex[:6]}"
            session.add(Post(
                title=title, slug=title.lower().replace(" ", "-"), content="Body", author_id=owner_id,
                blog_id=blog_id, status=PostStatus.PUBLISHED, published=True, views=views,
            ))
        session.commit()

    after = _rows(client, admin)[blog_id]
    assert after["total_posts"] - before["total_posts"] == 2
    assert after["total_views"] - before["total_views"] == 35
    assert after["team_members"] == 1
    assert after["last_activity"] is not None


def test_query_count_does_not_grow_with_workspaces(client):
    admin = _superadmin(client)
    with _count_queries() as first:
        _rows(client, admin)

    for _ in range(3):
        _register(client)

    with _count_queries() as second:
        _rows(client, admin)

    assert len(second) == len(first)


def test_detail_and_status_update_include_the_plan(client):
    admin = _superadmin(client)
    _, blog_id, _ = _register(client)
    _set_subscription(blog_id, plan=SubscriptionPlan.PRO, status="active", current_period_ends_at=_future(20))

    detail = client.get(f"/superadmin/blogs/{blog_id}", headers=admin)
    assert detail.status_code == 200, detail.text
    assert detail.json()["plan"] == "pro"

    updated = client.patch(f"/superadmin/blogs/{blog_id}", json={"is_active": False}, headers=admin)
    assert updated.status_code == 200, updated.text
    assert updated.json()["plan"] == "pro"
    assert updated.json()["is_active"] is False
