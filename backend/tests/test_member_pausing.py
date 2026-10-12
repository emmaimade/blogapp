"""
Members over the plan's seat limit — typically after a trial ends unpaid —
become read-only until the owner upgrades; the owner hears about it before
and after, and pending invitations that can no longer be accepted are
cancelled with a note to the invitee.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.core.plans import paused_member_user_ids
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Blog, BlogInvitation, BlogMember, BlogRole, BlogSubscription, Notification, SubscriptionPlan
from app.models.blog import OnboardingStatus
from app.modules.billing.trial_notices import run_trial_notices


@pytest.fixture
def sent(monkeypatch):
    outbox: list[dict] = []
    monkeypatch.setattr(
        "app.core.email.send_smtp_email",
        lambda to, subject, html, text: outbox.append({"to": to, "subject": subject, "text": text}),
    )
    return outbox


def _register(client) -> tuple[dict, int, int, str]:
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
    body = resp.json()["user"]
    return headers, body["blog_memberships"][0]["blog_id"], body["id"], email


def _set_plan(blog_id: int, plan: SubscriptionPlan, status: str = "active", **fields) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription.plan = plan
        subscription.status = status
        for key, value in fields.items():
            setattr(subscription, key, value)
        session.add(subscription)
        session.commit()


def _workspace_with_members(client, extra_members: int) -> tuple[dict, int, list[tuple[dict, int]]]:
    """An onboarded workspace plus `extra_members` editors, joined in order."""
    owner_headers, blog_id, _, _ = _register(client)
    members = []
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(blog)
        session.commit()
    for i in range(extra_members):
        headers, _, user_id, _ = _register(client)
        with Session(engine) as session:
            session.add(
                BlogMember(
                    user_id=user_id,
                    blog_id=blog_id,
                    role=BlogRole.EDITOR,
                    invited_at=datetime.now(timezone.utc) + timedelta(seconds=i),
                )
            )
            session.commit()
        members.append((headers, user_id))
    return owner_headers, blog_id, members


def _create_tag(client, headers, blog_id):
    return client.post(f"/blogs/{blog_id}/tags/", json={"name": f"tag-{uuid.uuid4().hex[:6]}"}, headers=headers)


def _paused(blog_id: int) -> set[int]:
    with Session(engine) as session:
        return paused_member_user_ids(session, blog_id)


# ── Who is paused ────────────────────────────────────────────────────────────

def test_everyone_but_the_owner_is_paused_on_free(client):
    _, blog_id, members = _workspace_with_members(client, 2)

    assert _paused(blog_id) == {user_id for _, user_id in members}


def test_nobody_is_paused_within_the_seat_limit(client):
    _, blog_id, _ = _workspace_with_members(client, 2)
    _set_plan(blog_id, SubscriptionPlan.PRO)  # 3 seats

    assert _paused(blog_id) == set()


def test_the_latest_joiners_are_the_ones_paused(client):
    _, blog_id, members = _workspace_with_members(client, 3)
    _set_plan(blog_id, SubscriptionPlan.PRO)  # owner + 2

    assert _paused(blog_id) == {members[2][1]}


def test_an_expired_trial_pauses_the_extra_members(client):
    _, blog_id, members = _workspace_with_members(client, 2)
    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) + timedelta(days=1))
    assert _paused(blog_id) == set()

    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    assert _paused(blog_id) == {user_id for _, user_id in members}


# ── What being paused means ──────────────────────────────────────────────────

def test_a_paused_member_can_read_but_not_write(client):
    _, blog_id, members = _workspace_with_members(client, 1)
    member_headers, _ = members[0]

    assert client.get(f"/blogs/{blog_id}/tags/", headers=member_headers).status_code == 200
    resp = _create_tag(client, member_headers, blog_id)
    assert resp.status_code == 403
    assert resp.json()["code"] == "MEMBER_ACCESS_PAUSED"


def test_the_owner_is_never_paused(client):
    owner_headers, blog_id, _ = _workspace_with_members(client, 2)

    assert _create_tag(client, owner_headers, blog_id).status_code == 200


def test_a_paused_member_can_still_leave(client):
    _, blog_id, members = _workspace_with_members(client, 1)
    member_headers, user_id = members[0]

    assert client.delete(f"/blogs/{blog_id}/members/me", headers=member_headers).status_code == 204
    with Session(engine) as session:
        assert session.exec(select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == user_id)).first() is None


def test_upgrading_restores_access_straight_away(client):
    _, blog_id, members = _workspace_with_members(client, 1)
    member_headers, _ = members[0]
    assert _create_tag(client, member_headers, blog_id).status_code == 403

    _set_plan(blog_id, SubscriptionPlan.PRO)

    assert _create_tag(client, member_headers, blog_id).status_code == 200


def test_the_studio_is_told_who_is_paused(client):
    owner_headers, blog_id, members = _workspace_with_members(client, 1)
    member_headers, member_id = members[0]

    me = client.get("/auth/me", headers=member_headers).json()
    membership = next(m for m in me["blog_memberships"] if m["blog_id"] == blog_id)
    assert membership["access_paused"] is True

    rows = client.get(f"/blogs/{blog_id}/members", headers=owner_headers).json()
    assert {row["user_id"]: row["access_paused"] for row in rows}[member_id] is True
    assert not any(row["access_paused"] for row in rows if row["role"] == "owner")


# ── Notices ──────────────────────────────────────────────────────────────────

def _notifications(blog_id: int, type: str) -> list[Notification]:
    with Session(engine) as session:
        return session.exec(select(Notification).where(Notification.blog_id == blog_id, Notification.type == type)).all()


def _run_notices():
    with Session(engine) as session:
        return run_trial_notices(session)


def test_owner_is_warned_once_before_a_cardless_trial_ends(client, sent):
    _, blog_id, _ = _workspace_with_members(client, 2)
    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) + timedelta(days=2))

    _run_notices()
    _run_notices()

    notices = _notifications(blog_id, "billing_trial_ending")
    assert len(notices) == 1
    assert "2 teammates would become view-only" in notices[0].body
    owner_emails = [m for m in sent if "trial for" in m["subject"] and "ends on" in m["subject"]]
    assert len(owner_emails) == 1
    assert "2 teammates will become view-only" in owner_emails[0]["text"]


def test_no_warning_when_a_card_is_already_on_file(client, sent):
    _, blog_id, _ = _workspace_with_members(client, 1)
    # Adding a card during a trial makes the subscription active until the
    # first charge on the trial's end date.
    _set_plan(
        blog_id,
        SubscriptionPlan.PRO,
        status="active",
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=2),
        current_period_ends_at=datetime.now(timezone.utc) + timedelta(days=2),
        paystack_subscription_code="SUB_test",
    )

    _run_notices()

    assert _notifications(blog_id, "billing_trial_ending") == []


def test_trial_ending_cancels_unusable_invitations_and_tells_everyone(client, sent):
    owner_headers, blog_id, _ = _workspace_with_members(client, 1)
    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) + timedelta(days=5))
    invitee = f"invitee-{uuid.uuid4().hex[:8]}@example.com"
    invite = client.post(f"/blogs/{blog_id}/invitations", json={"email": invitee, "role": "author"}, headers=owner_headers)
    assert invite.status_code == 201, invite.text
    sent.clear()

    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) - timedelta(hours=1))
    run = _run_notices()

    assert run.ended_notices == 1 and run.invitations_cancelled == 1
    with Session(engine) as session:
        assert session.exec(select(BlogInvitation).where(BlogInvitation.blog_id == blog_id)).all() == []
    invitee_mail = next(m for m in sent if m["to"] == invitee)
    assert "no longer available" in invitee_mail["subject"]
    assert "plan" not in invitee_mail["text"].lower()
    ended = _notifications(blog_id, "billing_trial_expired")
    assert len(ended) == 1 and "1 teammate is view-only" in ended[0].body

    _run_notices()
    assert len(_notifications(blog_id, "billing_trial_expired")) == 1


def test_long_expired_trials_are_left_alone(client, sent):
    _, blog_id, _ = _workspace_with_members(client, 1)
    _set_plan(blog_id, SubscriptionPlan.PRO, status="trialing", trial_ends_at=datetime.now(timezone.utc) - timedelta(days=10))
    sent.clear()

    _run_notices()

    assert _notifications(blog_id, "billing_trial_expired") == []
    assert sent == []


# ── Cron endpoint ────────────────────────────────────────────────────────────

def test_cron_endpoint_is_hidden_without_a_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", None)

    assert client.get("/internal/cron/trial-notices").status_code == 404


def test_cron_endpoint_needs_the_right_secret(client, monkeypatch, sent):
    monkeypatch.setattr(settings, "CRON_SECRET", "s3cret")

    assert client.get("/internal/cron/trial-notices", headers={"Authorization": "Bearer wrong"}).status_code == 401
    resp = client.get("/internal/cron/trial-notices", headers={"Authorization": "Bearer s3cret"})
    assert resp.status_code == 200, resp.text
    assert set(resp.json()) == {"ending_notices", "ended_notices", "invitations_cancelled"}
