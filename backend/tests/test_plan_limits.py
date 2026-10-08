"""
Plan limits: team seats, published-post cap, scheduling, activity log history
and the onboarding plan step starting a trial instead of granting the plan.

Limits only ever block adding something new — every test that downgrades a
workspace also checks what was already there keeps working.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, select

from app.core.db import engine
from app.core.exceptions import AuthorizationError
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import AuditLog, BlogSubscription, Post, SubscriptionPlan, User
from app.models.post import PostStatus
from app.modules.blogs.service import _apply_onboarding_plan_choice
from app.modules.posts import service as post_service
from app.schemas import PostCreate, PostUpdate


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client, email: str | None = None) -> tuple[dict, int, int]:
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
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _set_plan(blog_id: int, plan: SubscriptionPlan, status: str = "active", **fields) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.status = status
        for key, value in fields.items():
            setattr(subscription, key, value)
        session.add(subscription)
        session.commit()


def _add_published_posts(blog_id: int, author_id: int, count: int) -> None:
    with Session(engine) as session:
        for _ in range(count):
            session.add(
                Post(
                    title="Existing",
                    slug=f"post-{uuid.uuid4().hex[:10]}",
                    content="Body",
                    blog_id=blog_id,
                    author_id=author_id,
                    status=PostStatus.PUBLISHED,
                    published=True,
                    published_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
            )
        session.commit()


# The post routes also require completed onboarding, which plan limits don't
# touch — so, like test_post_publish_date, call the service directly.
def _create(blog_id: int, user_id: int, **fields) -> Post:
    with Session(engine) as session:
        user = session.get(User, user_id)
        post = post_service.create_post(
            blog_id, PostCreate(title="New post", content="Body", **fields), session, user
        )
        session.expunge(post)
        return post


def _update(blog_id: int, post_id: int, user_id: int, data: PostUpdate) -> Post:
    with Session(engine) as session:
        user = session.get(User, user_id)
        post = post_service.update_post(blog_id, post_id, data, session, user)
        session.expunge(post)
        return post


def _future() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=2)


# ── Team members ─────────────────────────────────────────────────────────────

def test_free_workspace_cannot_invite(client):
    headers, blog_id, _ = _register(client)

    resp = client.post(f"/blogs/{blog_id}/invitations", json={"email": _unique_email(), "role": "author"}, headers=headers)

    assert resp.status_code == 403
    assert resp.json()["code"] == "PLAN_UPGRADE_REQUIRED"


def test_pro_seats_count_pending_invitations(client):
    headers, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)

    # Owner + 2 pending invites fills Pro's 3 seats.
    first = _unique_email()
    for email in (first, _unique_email()):
        resp = client.post(f"/blogs/{blog_id}/invitations", json={"email": email, "role": "author"}, headers=headers)
        assert resp.status_code == 201, resp.text

    third = client.post(f"/blogs/{blog_id}/invitations", json={"email": _unique_email(), "role": "author"}, headers=headers)
    assert third.status_code == 403
    assert third.json()["code"] == "PLAN_UPGRADE_REQUIRED"

    # Resending a pending invite doesn't take another seat.
    resend = client.post(f"/blogs/{blog_id}/invitations", json={"email": first, "role": "editor"}, headers=headers)
    assert resend.status_code == 201, resend.text


def test_direct_member_add_respects_seats(client):
    headers, blog_id, _ = _register(client)
    member_email = _unique_email()
    _register(client, member_email)

    blocked = client.post(f"/blogs/{blog_id}/members", json={"email": member_email, "role": "author"}, headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "PLAN_UPGRADE_REQUIRED"

    _set_plan(blog_id, SubscriptionPlan.TEAM)
    allowed = client.post(f"/blogs/{blog_id}/members", json={"email": member_email, "role": "author"}, headers=headers)
    assert allowed.status_code == 201, allowed.text


def test_accepting_an_invite_after_downgrade_is_blocked(client):
    headers, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    invitee_email = _unique_email()
    invitee_headers, _, _ = _register(client, invitee_email)
    resp = client.post(f"/blogs/{blog_id}/invitations", json={"email": invitee_email, "role": "author"}, headers=headers)
    assert resp.status_code == 201, resp.text
    token = resp.json()["token"]

    # The trial runs out before the invite is accepted.
    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) - timedelta(days=1))

    accept = client.post(f"/invitations/{token}/accept", headers=invitee_headers)
    assert accept.status_code == 403
    assert accept.json()["code"] == "WORKSPACE_FULL"
    # The invitee isn't told anything about the workspace's plan.
    assert "plan" not in accept.json()["message"].lower()


def test_signing_up_through_invite_to_full_workspace_creates_no_account(client):
    headers, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    new_email = _unique_email()
    resp = client.post(f"/blogs/{blog_id}/invitations", json={"email": new_email, "role": "author"}, headers=headers)
    assert resp.status_code == 201, resp.text
    _set_plan(blog_id, SubscriptionPlan.FREE)

    signup = client.post(
        f"/invitations/{resp.json()['token']}/register-and-accept",
        json={"first_name": "Grace", "last_name": "Hopper", "password": "correcthorse1"},
    )

    assert signup.status_code == 403
    assert signup.json()["code"] == "WORKSPACE_FULL"
    assert "plan" not in signup.json()["message"].lower()
    with Session(engine) as session:
        assert session.exec(select(User).where(User.email == new_email)).first() is None


# ── Publishing & scheduling ──────────────────────────────────────────────────

def test_free_workspace_publish_cap(client):
    _, blog_id, user_id = _register(client)
    _add_published_posts(blog_id, user_id, 30)

    with pytest.raises(AuthorizationError) as exc:
        _create(blog_id, user_id, status="published")
    assert exc.value.code == "PLAN_UPGRADE_REQUIRED"

    # Drafts are always allowed, and so is re-saving a post that's already live.
    draft = _create(blog_id, user_id, status="draft")
    assert draft.status == PostStatus.DRAFT
    with Session(engine) as session:
        live_id = session.exec(
            select(Post.id).where(Post.blog_id == blog_id, Post.status == PostStatus.PUBLISHED)
        ).first()
    resaved = _update(blog_id, live_id, user_id, PostUpdate(title="Typo fix", status="published"))
    assert resaved.status == PostStatus.PUBLISHED

    with pytest.raises(AuthorizationError):
        _update(blog_id, draft.id, user_id, PostUpdate(status="published"))


def test_sample_posts_dont_count_toward_cap(client):
    _, blog_id, user_id = _register(client)
    _add_published_posts(blog_id, user_id, 29)
    with Session(engine) as session:
        session.add(
            Post(
                title="Welcome", slug=f"welcome-{uuid.uuid4().hex[:8]}", content="Hi", blog_id=blog_id,
                author_id=user_id, status=PostStatus.PUBLISHED, published=True, is_sample=True,
            )
        )
        session.commit()

    assert _create(blog_id, user_id, status="published").status == PostStatus.PUBLISHED


def test_paid_plan_has_no_publish_cap(client):
    _, blog_id, user_id = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    _add_published_posts(blog_id, user_id, 30)

    assert _create(blog_id, user_id, status="published").status == PostStatus.PUBLISHED


def test_free_workspace_cannot_schedule(client):
    _, blog_id, user_id = _register(client)

    with pytest.raises(AuthorizationError) as exc:
        _create(blog_id, user_id, status="scheduled", published_at=_future())
    assert exc.value.code == "PLAN_UPGRADE_REQUIRED"


def test_already_scheduled_post_stays_editable_after_downgrade(client):
    _, blog_id, user_id = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    scheduled = _create(blog_id, user_id, status="scheduled", published_at=_future())
    assert scheduled.status == PostStatus.SCHEDULED

    _set_plan(blog_id, SubscriptionPlan.FREE)

    edited = _update(blog_id, scheduled.id, user_id, PostUpdate(title="Edited", status="scheduled", published_at=_future()))
    assert edited.status == PostStatus.SCHEDULED


# ── Activity log history ─────────────────────────────────────────────────────

def test_activity_log_history_follows_plan(client):
    headers, blog_id, user_id = _register(client)
    with Session(engine) as session:
        for days_ago in (3, 30, 200):
            session.add(
                AuditLog(
                    action="tag.created",
                    resource_type="tag",
                    blog_id=blog_id,
                    actor_user_id=user_id,
                    details=f'{{"name": "aged-{days_ago}"}}',
                    created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
                )
            )
        session.commit()

    def visible() -> set[str]:
        resp = client.get(f"/blogs/{blog_id}/audit-logs", params={"action": "tag.created"}, headers=headers)
        assert resp.status_code == 200, resp.text
        return {row["description"] for row in resp.json()}

    assert visible() == {'Created tag "aged-3"'}
    _set_plan(blog_id, SubscriptionPlan.PRO)
    assert visible() == {'Created tag "aged-3"', 'Created tag "aged-30"'}
    _set_plan(blog_id, SubscriptionPlan.TEAM)
    assert len(visible()) == 3


# ── Onboarding plan step ─────────────────────────────────────────────────────

def test_onboarding_paid_choice_starts_trial():
    subscription = BlogSubscription(blog_id=0)

    _apply_onboarding_plan_choice(subscription, SubscriptionPlan.TEAM)

    assert subscription.plan == SubscriptionPlan.TEAM
    assert subscription.status == "trialing"
    assert subscription.trial_used is True
    days_left = (subscription.trial_ends_at - datetime.now(timezone.utc)).days
    assert 13 <= days_left <= 14


def test_onboarding_trial_only_once():
    subscription = BlogSubscription(
        blog_id=0, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True,
        trial_ends_at=datetime.now(timezone.utc) - timedelta(days=1),
    )

    with pytest.raises(AuthorizationError) as exc:
        _apply_onboarding_plan_choice(subscription, SubscriptionPlan.PRO)
    assert exc.value.code == "PLAN_UPGRADE_REQUIRED"

    _apply_onboarding_plan_choice(subscription, SubscriptionPlan.FREE)
    assert subscription.plan == SubscriptionPlan.FREE
    assert subscription.status == "active"


def test_onboarding_keeps_a_paid_plan():
    subscription = BlogSubscription(blog_id=0, plan=SubscriptionPlan.TEAM, status="active")

    _apply_onboarding_plan_choice(subscription, SubscriptionPlan.FREE)

    assert subscription.plan == SubscriptionPlan.TEAM
