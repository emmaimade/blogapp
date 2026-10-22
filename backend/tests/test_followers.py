"""
Following a blog by email: double opt-in, the identical answer whatever an
address's state, the honeypot, inbox-flooding limits, confirm and unsubscribe
links, re-following, and the plan's follower limit.
"""

import re
import uuid
from datetime import timedelta

import pytest
from sqlmodel import Session, select

from app.core.datetimes import utc_now
from app.core.db import engine
from app.models import Blog, BlogFollower, BlogSubscription, FollowerStatus, Post, SubscriptionPlan
from app.models.post import PostStatus
from app.modules.followers import service as follower_service


@pytest.fixture
def sent(monkeypatch):
    """Follow confirmations sent; registering the blog's owner sends its own emails, left out."""
    outbox: list[dict] = []

    def capture(to, subject, html, text):
        if subject.startswith("Confirm you want to follow"):
            outbox.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr("app.core.email.send_smtp_email", capture)
    return outbox


def _register(client) -> tuple[int, int]:
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
    client.cookies.clear()  # follow as an anonymous reader
    return body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _email() -> str:
    return f"reader-{uuid.uuid4().hex[:10]}@example.com"


def _follow(client, blog_id: int, email: str, **fields):
    return client.post(f"/blogs/{blog_id}/followers", json={"email": email, **fields})


def _token_from(message: dict) -> str:
    return re.search(r"/follow/confirm\?token=(\S+)", message["text"]).group(1)


def _follower(blog_id: int, email: str) -> BlogFollower | None:
    with Session(engine) as session:
        return session.exec(
            select(BlogFollower).where(BlogFollower.blog_id == blog_id, BlogFollower.email == email.lower())
        ).first()


def _set_follower(follower_id: int, **fields) -> None:
    with Session(engine) as session:
        follower = session.get(BlogFollower, follower_id)
        for key, value in fields.items():
            setattr(follower, key, value)
        session.add(follower)
        session.commit()


def _add_active_followers(blog_id: int, count: int) -> None:
    with Session(engine) as session:
        for _ in range(count):
            session.add(BlogFollower(blog_id=blog_id, email=_email(), status=FollowerStatus.ACTIVE))
        session.commit()


def _set_plan(blog_id: int, plan: SubscriptionPlan) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.status = "active"
        session.add(subscription)
        session.commit()


# ── Following ────────────────────────────────────────────────────────────────

def test_following_creates_a_pending_follower_and_emails_a_confirmation(client, sent):
    blog_id, _ = _register(client)
    email = _email()

    res = _follow(client, blog_id, email.upper())

    assert res.status_code == 202, res.text
    follower = _follower(blog_id, email)
    assert follower.status == FollowerStatus.PENDING
    assert follower.email == email  # stored lowercased
    assert len(sent) == 1 and sent[0]["to"] == email
    assert "/follow/confirm?token=" in sent[0]["text"]


def test_the_answer_is_the_same_whatever_the_address_state(client, sent):
    blog_id, _ = _register(client)
    email = _email()

    first = _follow(client, blog_id, email)
    client.post("/followers/confirm", json={"token": _token_from(sent[0])})
    again = _follow(client, blog_id, email)

    assert first.status_code == again.status_code == 202
    assert first.json() == again.json()
    assert len(sent) == 1  # nothing sent to an address that already follows


def test_the_honeypot_drops_the_request_silently(client, sent):
    blog_id, _ = _register(client)
    email = _email()

    res = _follow(client, blog_id, email, website="http://spam.example")

    assert res.status_code == 202
    assert _follower(blog_id, email) is None
    assert sent == []


def test_source_post_is_kept_only_when_it_is_a_published_post_of_this_blog(client, sent):
    blog_id, user_id = _register(client)
    other_blog_id, _ = _register(client)
    with Session(engine) as session:
        own = Post(title="Own", slug=f"own-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id,
                   author_id=user_id, status=PostStatus.PUBLISHED, published=True)
        foreign = Post(title="Other", slug=f"other-{uuid.uuid4().hex[:6]}", content="x", blog_id=other_blog_id,
                       status=PostStatus.PUBLISHED, published=True)
        session.add_all([own, foreign])
        session.commit()
        own_id, foreign_id = own.id, foreign.id

    kept, dropped = _email(), _email()
    _follow(client, blog_id, kept, source_post_id=own_id)
    _follow(client, blog_id, dropped, source_post_id=foreign_id)

    assert _follower(blog_id, kept).source_post_id == own_id
    assert _follower(blog_id, dropped).source_post_id is None


# ── Inbox-flooding limits ────────────────────────────────────────────────────

def test_one_address_is_not_emailed_again_within_ten_minutes(client, sent):
    blog_id, _ = _register(client)
    email = _email()

    _follow(client, blog_id, email)
    res = _follow(client, blog_id, email)

    assert res.status_code == 202
    assert len(sent) == 1


def test_one_address_gets_at_most_three_confirmations_a_day(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)
    follower_id = _follower(blog_id, email).id

    for _ in range(3):
        # Step past the 10-minute gap without leaving the day.
        _set_follower(follower_id, confirm_sent_at=utc_now() - timedelta(minutes=11))
        _follow(client, blog_id, email)

    assert len(sent) == 3


def test_a_blog_sends_at_most_thirty_confirmations_an_hour(client, sent, monkeypatch):
    monkeypatch.setattr(follower_service, "BLOG_SENDS_PER_HOUR", 2)
    blog_id, _ = _register(client)

    assert _follow(client, blog_id, _email()).status_code == 202
    assert _follow(client, blog_id, _email()).status_code == 202
    res = _follow(client, blog_id, _email())

    assert res.status_code == 429
    assert len(sent) == 2


# ── Confirming ───────────────────────────────────────────────────────────────

def test_confirming_activates_the_follower(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)

    res = client.post("/followers/confirm", json={"token": _token_from(sent[0])})

    assert res.status_code == 200, res.text
    with Session(engine) as session:
        assert res.json() == {"blog_name": session.get(Blog, blog_id).name}
    follower = _follower(blog_id, email)
    assert follower.status == FollowerStatus.ACTIVE
    assert follower.confirmed_at is not None


def test_a_second_click_on_the_confirm_link_still_succeeds(client, sent):
    blog_id, _ = _register(client)
    _follow(client, blog_id, _email())
    token = _token_from(sent[0])

    client.post("/followers/confirm", json={"token": token})
    res = client.post("/followers/confirm", json={"token": token})

    assert res.status_code == 200


def test_an_unknown_confirm_link_is_invalid(client):
    res = client.post("/followers/confirm", json={"token": "not-a-real-token"})

    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_TOKEN"


def test_a_confirm_link_expires_after_seven_days(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)
    _set_follower(_follower(blog_id, email).id, confirm_sent_at=utc_now() - timedelta(days=8))

    res = client.post("/followers/confirm", json={"token": _token_from(sent[0])})

    assert res.status_code == 410
    assert res.json()["code"] == "LINK_EXPIRED"
    assert _follower(blog_id, email).status == FollowerStatus.PENDING


# ── Unsubscribing ────────────────────────────────────────────────────────────

def test_unsubscribing_is_safe_to_repeat(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)
    client.post("/followers/confirm", json={"token": _token_from(sent[0])})
    token = follower_service.unsubscribe_token(_follower(blog_id, email).id)

    first = client.post("/followers/unsubscribe", json={"token": token})
    second = client.post("/followers/unsubscribe", json={"token": token})

    assert first.status_code == second.status_code == 200
    follower = _follower(blog_id, email)
    assert follower.status == FollowerStatus.UNSUBSCRIBED
    assert follower.unsubscribed_at is not None


def test_a_tampered_unsubscribe_link_is_invalid(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)
    follower_id = _follower(blog_id, email).id

    for token in (f"{follower_id}.{'0' * 32}", f"{follower_id + 1}.{follower_service.unsubscribe_token(follower_id).split('.')[1]}", "junk"):
        res = client.post("/followers/unsubscribe", json={"token": token})
        assert res.status_code == 400, token
    assert _follower(blog_id, email).status == FollowerStatus.PENDING


def test_an_old_confirm_link_does_not_undo_an_unsubscribe(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)
    confirm_token = _token_from(sent[0])
    client.post("/followers/confirm", json={"token": confirm_token})
    client.post("/followers/unsubscribe", json={"token": follower_service.unsubscribe_token(_follower(blog_id, email).id)})

    res = client.post("/followers/confirm", json={"token": confirm_token})

    assert res.status_code == 400
    assert _follower(blog_id, email).status == FollowerStatus.UNSUBSCRIBED


def test_following_again_after_unsubscribing_needs_a_new_confirmation(client, sent):
    blog_id, _ = _register(client)
    email = _email()
    _follow(client, blog_id, email)
    client.post("/followers/confirm", json={"token": _token_from(sent[0])})
    follower_id = _follower(blog_id, email).id
    client.post("/followers/unsubscribe", json={"token": follower_service.unsubscribe_token(follower_id)})
    _set_follower(follower_id, confirm_sent_at=utc_now() - timedelta(days=2))

    _follow(client, blog_id, email)

    assert len(sent) == 2
    assert _follower(blog_id, email).status == FollowerStatus.PENDING
    client.post("/followers/confirm", json={"token": _token_from(sent[1])})
    assert _follower(blog_id, email).status == FollowerStatus.ACTIVE


# ── Plan limit ───────────────────────────────────────────────────────────────

def test_following_is_refused_at_the_plans_limit(client, sent):
    blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)
    _add_active_followers(blog_id, 500)

    res = _follow(client, blog_id, _email())

    assert res.status_code == 403
    assert res.json()["code"] == "FOLLOWERS_LIMIT_REACHED"
    assert sent == []


def test_confirming_is_refused_at_the_limit_and_existing_followers_stay(client, sent):
    blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)
    _add_active_followers(blog_id, 499)
    first, second = _email(), _email()
    _follow(client, blog_id, first)
    _follow(client, blog_id, second)

    assert client.post("/followers/confirm", json={"token": _token_from(sent[0])}).status_code == 200
    res = client.post("/followers/confirm", json={"token": _token_from(sent[1])})

    assert res.status_code == 403
    assert _follower(blog_id, second).status == FollowerStatus.PENDING
    with Session(engine) as session:
        active = session.exec(
            select(BlogFollower).where(BlogFollower.blog_id == blog_id, BlogFollower.status == FollowerStatus.ACTIVE)
        ).all()
        assert len(active) == 500


def test_paid_plans_raise_the_limit(client, sent):
    blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    _add_active_followers(blog_id, 500)

    assert _follow(client, blog_id, _email()).status_code == 202
    assert len(sent) == 1


# ── Deletion ─────────────────────────────────────────────────────────────────

def test_deleting_a_post_keeps_its_followers_and_drops_its_view_rows(client, sent):
    from app.models import PostViewDaily

    blog_id, user_id = _register(client)
    with Session(engine) as session:
        post = Post(title="Gone", slug=f"gone-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id,
                    author_id=user_id, status=PostStatus.PUBLISHED, published=True)
        session.add(post)
        session.commit()
        post_id = post.id
        session.add(PostViewDaily(blog_id=blog_id, post_id=post_id, day=utc_now().date(), views=3))
        session.commit()
    email = _email()
    _follow(client, blog_id, email, source_post_id=post_id)

    with Session(engine) as session:
        session.delete(session.get(Post, post_id))
        session.commit()

    follower = _follower(blog_id, email)
    assert follower is not None and follower.source_post_id is None
    with Session(engine) as session:
        assert session.exec(select(PostViewDaily).where(PostViewDaily.post_id == post_id)).first() is None


def test_deleting_a_blog_deletes_its_followers(client, sent):
    from app.services.deletion import delete_blog_permanently

    blog_id, _ = _register(client)
    _add_active_followers(blog_id, 2)

    with Session(engine) as session:
        delete_blog_permanently(session, session.get(Blog, blog_id))
        session.commit()

    with Session(engine) as session:
        assert session.exec(select(BlogFollower).where(BlogFollower.blog_id == blog_id)).first() is None
