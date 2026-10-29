"""
Recommendations between blogs: the owner's list (no self, no duplicates, up
to five, only blogs that qualify, owner only), the opt-out, what readers see,
following from the confirm page with the token just used (active at once,
only blogs actually recommended, limits respected, attribution kept), and the
sent/received numbers.
"""

import re
import uuid

import pytest
from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import (
    Blog,
    BlogFollower,
    BlogMember,
    BlogRole,
    BlogSubscription,
    FollowerStatus,
    Notification,
    OnboardingStatus,
    Post,
    SubscriptionPlan,
)
from app.models.post import PostStatus


@pytest.fixture
def sent(monkeypatch):
    outbox: list[dict] = []

    def capture(to, subject, html, text):
        if subject.startswith("Confirm you want to follow"):
            outbox.append({"to": to, "text": text})

    monkeypatch.setattr("app.core.email.send_smtp_email", capture)
    return outbox


def _blog(client, *, ready: bool = True) -> tuple[dict, int, int]:
    """A registered owner's blog; `ready` = onboarded with a published post, so it can be recommended."""
    resp = client.post("/users/register", json={
        "first_name": "Ada", "last_name": "Lovelace",
        "email": f"user-{uuid.uuid4().hex[:12]}@example.com", "password": "correcthorse1",
        "workspace_name": f"Blog {uuid.uuid4().hex[:6]}",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    client.cookies.clear()
    blog_id, user_id = body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]
    if ready:
        with Session(engine) as session:
            blog = session.get(Blog, blog_id)
            blog.onboarding_status = OnboardingStatus.COMPLETED
            session.add(blog)
            session.add(Post(title="Hello", slug=f"hello-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id,
                             author_id=user_id, status=PostStatus.PUBLISHED, published=True))
            session.commit()
    return headers, blog_id, user_id


def _recommend(client, headers, blog_id, ids):
    return client.put(f"/blogs/{blog_id}/recommendations", json={"blog_ids": ids}, headers=headers)


def _confirm_token(client, blog_id: int, email: str, sent: list) -> str:
    assert client.post(f"/blogs/{blog_id}/followers", json={"email": email}).status_code == 202
    return re.search(r"/follow/confirm\?token=(\S+)", sent[-1]["text"]).group(1)


def _follower(blog_id: int, email: str) -> BlogFollower | None:
    with Session(engine) as session:
        return session.exec(select(BlogFollower).where(BlogFollower.blog_id == blog_id, BlogFollower.email == email)).first()


# ── The owner's list ─────────────────────────────────────────────────────────

def test_an_owner_recommends_blogs_in_order_and_their_owners_are_told(client):
    owner, blog_id, _ = _blog(client)
    _, first, first_owner = _blog(client)
    _, second, _ = _blog(client)

    res = _recommend(client, owner, blog_id, [second, first])

    assert res.status_code == 200, res.text
    assert [r["id"] for r in res.json()["recommendations"]] == [second, first]
    assert [r["id"] for r in client.get(f"/blogs/{blog_id}/recommendations").json()] == [second, first]
    with Session(engine) as session:
        assert session.exec(select(Notification).where(
            Notification.user_id == first_owner, Notification.type == "blog_recommended")).first() is not None


@pytest.mark.parametrize("problem", ["self", "duplicate", "too_many"])
def test_the_list_rules(client, problem):
    owner, blog_id, _ = _blog(client)
    others = [_blog(client)[1] for _ in range(6 if problem == "too_many" else 1)]
    ids = {"self": [blog_id], "duplicate": [others[0], others[0]], "too_many": others}[problem]

    assert _recommend(client, owner, blog_id, ids).status_code == 422


def test_only_blogs_that_qualify_can_be_added(client):
    owner, blog_id, _ = _blog(client)
    _, empty, _ = _blog(client, ready=False)  # no posts yet
    target_headers, opted_out, _ = _blog(client)
    client.patch(f"/blogs/{opted_out}/recommendations/settings", json={"allow_recommendations": False}, headers=target_headers)

    assert _recommend(client, owner, blog_id, [empty]).status_code == 400
    assert _recommend(client, owner, blog_id, [opted_out]).status_code == 400


def test_only_the_owner_manages_recommendations(client):
    _, blog_id, _ = _blog(client)
    editor, _, editor_id = _blog(client)
    _, other, _ = _blog(client)
    with Session(engine) as session:
        session.add(BlogMember(blog_id=blog_id, user_id=editor_id, role=BlogRole.EDITOR))
        session.commit()

    assert _recommend(client, editor, blog_id, [other]).status_code == 403
    assert client.get(f"/blogs/{blog_id}/recommendations/manage", headers=editor).status_code == 403


def test_search_finds_blogs_by_name_but_not_itself_or_opted_out_ones(client):
    owner, blog_id, _ = _blog(client)
    target_headers, target, _ = _blog(client)
    with Session(engine) as session:
        name = session.get(Blog, target).name
        own_name = session.get(Blog, blog_id).name

    found = client.get(f"/blogs/{blog_id}/recommendations/search", params={"q": name}, headers=owner).json()
    assert [b["id"] for b in found] == [target]
    assert client.get(f"/blogs/{blog_id}/recommendations/search", params={"q": own_name}, headers=owner).json() == []

    client.patch(f"/blogs/{target}/recommendations/settings", json={"allow_recommendations": False}, headers=target_headers)
    assert client.get(f"/blogs/{blog_id}/recommendations/search", params={"q": name}, headers=owner).json() == []


def test_a_blog_that_stops_qualifying_is_hidden_not_removed(client):
    owner, blog_id, _ = _blog(client)
    target_headers, target, _ = _blog(client)
    _recommend(client, owner, blog_id, [target])

    client.patch(f"/blogs/{target}/recommendations/settings", json={"allow_recommendations": False}, headers=target_headers)

    assert client.get(f"/blogs/{blog_id}/recommendations").json() == []
    managed = client.get(f"/blogs/{blog_id}/recommendations/manage", headers=owner).json()["recommendations"]
    assert [(r["id"], r["shown"]) for r in managed] == [(target, False)]


# ── Following from the confirm page ──────────────────────────────────────────

def test_confirming_shows_the_recommendations_and_one_tap_follows_them(client, sent):
    owner, blog_id, _ = _blog(client)
    _, target, _ = _blog(client)
    _recommend(client, owner, blog_id, [target])
    email = f"reader-{uuid.uuid4().hex[:8]}@example.com"
    token = _confirm_token(client, blog_id, email, sent)

    confirmed = client.post("/followers/confirm", json={"token": token}).json()
    assert [r["id"] for r in confirmed["recommendations"]] == [target]

    res = client.post("/followers/recommendations/follow", json={"token": token, "blog_ids": [target]})
    assert res.status_code == 200, res.text
    assert len(res.json()["followed"]) == 1
    follower = _follower(target, email)
    assert follower.status == FollowerStatus.ACTIVE
    assert follower.referred_by_blog_id == blog_id
    assert len(sent) == 1  # no second confirmation email


def test_only_recommended_blogs_can_be_followed_this_way(client, sent):
    owner, blog_id, _ = _blog(client)
    _, unrelated, _ = _blog(client)
    token = _confirm_token(client, blog_id, f"r-{uuid.uuid4().hex[:8]}@example.com", sent)
    client.post("/followers/confirm", json={"token": token})

    res = client.post("/followers/recommendations/follow", json={"token": token, "blog_ids": [unrelated]})

    assert res.status_code == 403


def test_a_bad_or_unconfirmed_token_cant_follow(client, sent):
    owner, blog_id, _ = _blog(client)
    _, target, _ = _blog(client)
    _recommend(client, owner, blog_id, [target])
    token = _confirm_token(client, blog_id, f"r-{uuid.uuid4().hex[:8]}@example.com", sent)

    assert client.post("/followers/recommendations/follow", json={"token": "nope", "blog_ids": [target]}).status_code == 400
    # Not confirmed yet: the link hasn't been clicked.
    assert client.post("/followers/recommendations/follow", json={"token": token, "blog_ids": [target]}).status_code == 400


def test_already_following_and_full_blogs_are_skipped_not_failed(client, sent):
    owner, blog_id, _ = _blog(client)
    _, already, _ = _blog(client)
    _, full, _ = _blog(client)
    _recommend(client, owner, blog_id, [already, full])
    email = f"r-{uuid.uuid4().hex[:8]}@example.com"
    with Session(engine) as session:
        session.add(BlogFollower(blog_id=already, email=email, status=FollowerStatus.ACTIVE))
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == full)).first() \
            or BlogSubscription(blog_id=full)
        subscription.plan, subscription.status = SubscriptionPlan.FREE, "active"
        session.add(subscription)
        for _ in range(500):
            session.add(BlogFollower(blog_id=full, email=f"f-{uuid.uuid4().hex[:10]}@example.com", status=FollowerStatus.ACTIVE))
        session.commit()
    token = _confirm_token(client, blog_id, email, sent)
    client.post("/followers/confirm", json={"token": token})

    res = client.post("/followers/recommendations/follow", json={"token": token, "blog_ids": [already, full]})

    assert res.status_code == 200
    assert res.json()["followed"] == [] and len(res.json()["skipped"]) == 2
    assert _follower(full, email) is None


# ── Numbers ──────────────────────────────────────────────────────────────────

def test_sent_and_received_followers_are_counted(client, sent):
    owner, blog_id, _ = _blog(client)
    target_headers, target, _ = _blog(client)
    _recommend(client, owner, blog_id, [target])
    for _ in range(2):
        token = _confirm_token(client, blog_id, f"r-{uuid.uuid4().hex[:8]}@example.com", sent)
        client.post("/followers/confirm", json={"token": token})
        client.post("/followers/recommendations/follow", json={"token": token, "blog_ids": [target]})

    mine = client.get(f"/blogs/{blog_id}/recommendations/manage", headers=owner).json()
    theirs = client.get(f"/blogs/{target}/recommendations/manage", headers=target_headers).json()

    assert mine["recommendations"][0]["followers_sent"] == 2
    assert [(r["id"], r["followers"], r["recommends_you_now"]) for r in theirs["received"]] == [(blog_id, 2, True)]
