"""
The signed-in user's membership list carries each workspace's plan, but only
on memberships the user owns: billing isn't shown to editors or authors.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Blog, BlogMember, BlogRole, BlogSubscription, SubscriptionPlan
from app.models.blog import SubscriptionStatus


def _register(client) -> tuple[dict, int, int]:
    """Returns (auth headers, user_id, blog_id of the workspace created at signup)."""
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
    return headers, body["user"]["id"], body["user"]["blog_memberships"][0]["blog_id"]


def _memberships(client, headers) -> dict[int, dict]:
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    return {m["blog_id"]: m for m in me.json()["blog_memberships"]}


def test_owner_sees_their_workspace_plan(client):
    headers, _, blog_id = _register(client)

    assert _memberships(client, headers)[blog_id]["plan"] == "free"


def _set_subscription(blog_id: int, **fields) -> None:
    with Session(engine) as session:
        sub = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        for key, value in fields.items():
            setattr(sub, key, value)
        session.add(sub)
        session.commit()


def test_owner_sees_a_paid_plan(client):
    headers, _, blog_id = _register(client)
    # Active with no period end = granted by hand, so it counts as Pro.
    _set_subscription(
        blog_id, plan=SubscriptionPlan.PRO, status=SubscriptionStatus.ACTIVE.value, current_period_ends_at=None
    )

    assert _memberships(client, headers)[blog_id]["plan"] == "pro"


def test_owner_sees_the_effective_plan_not_the_raw_row(client):
    headers, _, blog_id = _register(client)
    _set_subscription(
        blog_id,
        plan=SubscriptionPlan.PRO,
        status=SubscriptionStatus.TRIALING.value,
        trial_ends_at=datetime.now(timezone.utc) - timedelta(days=1),
    )

    assert _memberships(client, headers)[blog_id]["plan"] == "free"


def test_editor_and_author_do_not_see_the_plan(client):
    _, _, other_blog_id = _register(client)
    _, _, third_blog_id = _register(client)
    headers, user_id, own_blog_id = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(user_id=user_id, blog_id=other_blog_id, role=BlogRole.EDITOR))
        session.add(BlogMember(user_id=user_id, blog_id=third_blog_id, role=BlogRole.AUTHOR))
        session.commit()

    memberships = _memberships(client, headers)

    assert memberships[own_blog_id]["plan"] == "free"
    assert memberships[other_blog_id]["plan"] is None
    assert memberships[third_blog_id]["plan"] is None


def test_membership_blog_includes_logo_url(client):
    headers, _, blog_id = _register(client)
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.logo_url = "https://cdn.example.com/logo.png"
        session.add(blog)
        session.commit()

    assert _memberships(client, headers)[blog_id]["blog"]["logo_url"] == "https://cdn.example.com/logo.png"
