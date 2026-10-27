"""
Sponsor slots and the "Advertise with us" page: owner-only management, the
Pro+ plan rule (and sponsors going quiet, not deleted, on a downgrade), which
sponsor runs, impressions and clicks that skip bots and the team, a click
redirect that only ever goes to the stored URL, and the Advertise page's
live numbers, visibility switches and enquiry form.
"""

import uuid
from datetime import timedelta

import pytest
from sqlmodel import Session, select

from app.core.datetimes import utc_now
from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import (
    AdvertiseEnquiry,
    BlogFollower,
    BlogMember,
    BlogRole,
    BlogSourceDaily,
    BlogSubscription,
    BlogVisitorDaily,
    FollowerStatus,
    Post,
    PostViewDaily,
    SponsorDaily,
    SubscriptionPlan,
)
from app.models.post import PostStatus
from app.modules.sponsors import service as sponsor_service

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"


@pytest.fixture
def sent(monkeypatch):
    outbox: list[dict] = []

    def capture(to, subject, html, text):
        if subject.startswith("Sponsorship enquiry"):
            outbox.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr("app.core.email.send_smtp_email", capture)
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
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    client.cookies.clear()
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"], email


def _set_plan(blog_id: int, plan: SubscriptionPlan) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.status = "active"
        session.add(subscription)
        session.commit()


def _sponsor(client, headers: dict, blog_id: int, **fields):
    body = {"name": "Acme Foods", "url": "https://acme.example/offer", "placement": "post_end",
            "tagline": "Jollof spice, done right", **fields}
    return client.post(f"/blogs/{blog_id}/sponsors", json=body, headers=headers)


def _pro_blog_with_sponsor(client, **fields) -> tuple[dict, int, int]:
    owner, blog_id, _, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    res = _sponsor(client, owner, blog_id, **fields)
    assert res.status_code == 201, res.text
    return owner, blog_id, res.json()["id"]


def _counts(sponsor_id: int) -> tuple[int, int]:
    with Session(engine) as session:
        rows = session.exec(select(SponsorDaily).where(SponsorDaily.sponsor_id == sponsor_id)).all()
        return sum(r.impressions for r in rows), sum(r.clicks for r in rows)


# ── Plans and access ─────────────────────────────────────────────────────────

def test_free_cant_add_sponsors(client):
    owner, blog_id, _, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)

    res = _sponsor(client, owner, blog_id)

    assert res.status_code == 403
    assert res.json()["code"] == "PLAN_UPGRADE_REQUIRED"


def test_only_the_owner_manages_sponsors_and_the_advertise_page(client):
    owner, blog_id, _, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    editor, _, editor_id, _ = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(blog_id=blog_id, user_id=editor_id, role=BlogRole.EDITOR))
        session.commit()

    assert _sponsor(client, editor, blog_id).status_code == 403
    assert client.get(f"/blogs/{blog_id}/sponsors", headers=editor).status_code == 403
    assert client.put(f"/blogs/{blog_id}/advertise/settings", json={"enabled": True}, headers=editor).status_code == 403
    assert client.get(f"/blogs/{blog_id}/sponsors", headers=owner).status_code == 200


def test_sponsor_links_must_be_https(client):
    owner, blog_id, _, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)

    for url in ("http://acme.example", "javascript:alert(1)", "acme.example"):
        assert _sponsor(client, owner, blog_id, url=url).status_code == 422, url


# ── What runs ────────────────────────────────────────────────────────────────

def test_a_running_sponsor_shows_and_paused_scheduled_and_ended_ones_dont(client):
    owner, blog_id, sponsor_id = _pro_blog_with_sponsor(client)
    today = utc_now().date()
    _sponsor(client, owner, blog_id, name="Later", starts_on=(today + timedelta(days=3)).isoformat())
    _sponsor(client, owner, blog_id, name="Done", ends_on=(today - timedelta(days=1)).isoformat(),
             starts_on=(today - timedelta(days=9)).isoformat())
    _sponsor(client, owner, blog_id, name="Off", is_active=False)

    shown = client.get(f"/blogs/{blog_id}/sponsors/active", params={"placement": "post_end"}).json()
    home = client.get(f"/blogs/{blog_id}/sponsors/active", params={"placement": "home"}).json()

    assert shown["id"] == sponsor_id and shown["name"] == "Acme Foods"
    assert shown["click_url"].endswith(f"/s/{sponsor_id}")
    assert "url" not in shown  # the blog gets the click counter, not the raw link
    assert home is None
    states = {s["name"]: s["state"] for s in client.get(f"/blogs/{blog_id}/sponsors", headers=owner).json()}
    assert states == {"Acme Foods": "running", "Later": "scheduled", "Done": "ended", "Off": "paused"}


def test_a_downgrade_hides_sponsors_without_deleting_them(client):
    owner, blog_id, sponsor_id = _pro_blog_with_sponsor(client)

    _set_plan(blog_id, SubscriptionPlan.FREE)

    assert client.get(f"/blogs/{blog_id}/sponsors/active", params={"placement": "post_end"}).json() is None
    assert [s["id"] for s in client.get(f"/blogs/{blog_id}/sponsors", headers=owner).json()] == [sponsor_id]


# ── Impressions and clicks ───────────────────────────────────────────────────

def test_impressions_count_readers_only(client):
    owner, blog_id, sponsor_id = _pro_blog_with_sponsor(client)

    client.post(f"/sponsors/{sponsor_id}/impression", headers={"User-Agent": BROWSER_UA})
    client.post(f"/sponsors/{sponsor_id}/impression", headers={"User-Agent": "Googlebot/2.1"})
    client.post(f"/sponsors/{sponsor_id}/impression", headers={"User-Agent": BROWSER_UA, **owner})

    assert _counts(sponsor_id) == (1, 0)


def test_a_click_is_counted_and_redirects_to_the_stored_url_only(client):
    _, blog_id, sponsor_id = _pro_blog_with_sponsor(client)

    res = client.get(f"/s/{sponsor_id}", params={"url": "https://evil.example"},
                     headers={"User-Agent": BROWSER_UA}, follow_redirects=False)

    assert res.status_code == 302
    assert res.headers["location"] == "https://acme.example/offer"
    assert _counts(sponsor_id) == (0, 1)
    listed = client.get(f"/blogs/{blog_id}/sponsors", headers=_register(client)[0])
    assert listed.status_code == 403  # someone else's blog


def test_a_click_on_an_unknown_sponsor_is_not_found(client):
    assert client.get("/s/999999", follow_redirects=False).status_code == 404


# ── Advertise page ───────────────────────────────────────────────────────────

def test_the_advertise_page_is_hidden_until_turned_on(client):
    owner, blog_id, _, _ = _register(client)

    assert client.get(f"/blogs/{blog_id}/advertise").status_code == 404
    res = client.put(f"/blogs/{blog_id}/advertise/settings", json={"enabled": True, "intro": "Reach cooks."}, headers=owner)
    assert res.status_code == 200, res.text
    assert client.get(f"/blogs/{blog_id}/advertise").status_code == 200


def test_the_advertise_page_shows_live_numbers_and_respects_the_switches(client):
    owner, blog_id, user_id, _ = _register(client)
    today = utc_now().date()
    with Session(engine) as session:
        post = Post(title="Best jollof", slug=f"jollof-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id,
                    author_id=user_id, status=PostStatus.PUBLISHED, published=True)
        session.add(post)
        session.commit()
        session.add_all([
            PostViewDaily(blog_id=blog_id, post_id=post.id, day=today, views=120),
            PostViewDaily(blog_id=blog_id, post_id=post.id, day=today - timedelta(days=40), views=999),  # too old
            BlogVisitorDaily(blog_id=blog_id, day=today, visitors=80),
            BlogSourceDaily(blog_id=blog_id, day=today, source="WhatsApp", visits=3),
            BlogSourceDaily(blog_id=blog_id, day=today, source="Google", visits=1),
            BlogFollower(blog_id=blog_id, email=f"r-{uuid.uuid4().hex[:8]}@example.com", status=FollowerStatus.ACTIVE),
        ])
        session.commit()
    packages = [{"name": "Sponsored post", "price": "₦50,000", "description": "One post, shared on WhatsApp"}]
    client.put(f"/blogs/{blog_id}/advertise/settings", json={"enabled": True, "packages": packages}, headers=owner)

    page = client.get(f"/blogs/{blog_id}/advertise").json()
    assert (page["monthly_readers"], page["monthly_views"], page["followers"]) == (80, 120, 1)
    assert page["sources"] == [{"source": "WhatsApp", "share": 75}, {"source": "Google", "share": 25}]
    assert page["top_posts"][0]["title"] == "Best jollof"
    assert page["packages"] == packages

    client.put(f"/blogs/{blog_id}/advertise/settings",
               json={"enabled": True, "show_followers": False, "show_sources": False, "show_top_posts": False}, headers=owner)
    hidden = client.get(f"/blogs/{blog_id}/advertise").json()
    assert hidden["followers"] is None and hidden["sources"] is None and hidden["top_posts"] is None


def test_an_enquiry_is_emailed_to_the_owner(client, sent):
    owner, blog_id, _, owner_email = _register(client)
    client.put(f"/blogs/{blog_id}/advertise/settings", json={"enabled": True}, headers=owner)

    res = client.post(f"/blogs/{blog_id}/advertise/enquiry", json={
        "name": "Bola", "email": "bola@brand.example", "company": "Brand Co", "budget": "₦100k",
        "message": "We'd like a month on your home page.",
    })

    assert res.status_code == 202
    assert len(sent) == 1 and sent[0]["to"] == owner_email
    assert "bola@brand.example" in sent[0]["text"]


def test_the_enquiry_honeypot_and_hourly_limit(client, sent, monkeypatch):
    monkeypatch.setattr(sponsor_service, "ENQUIRIES_PER_HOUR", 2)
    owner, blog_id, _, _ = _register(client)
    client.put(f"/blogs/{blog_id}/advertise/settings", json={"enabled": True}, headers=owner)
    body = {"name": "Bola", "email": "bola@brand.example", "message": "Hello"}

    assert client.post(f"/blogs/{blog_id}/advertise/enquiry", json={**body, "website": "spam"}).status_code == 202
    assert client.post(f"/blogs/{blog_id}/advertise/enquiry", json=body).status_code == 202
    assert client.post(f"/blogs/{blog_id}/advertise/enquiry", json=body).status_code == 202
    assert client.post(f"/blogs/{blog_id}/advertise/enquiry", json=body).status_code == 429

    assert len(sent) == 2  # the bot's was dropped
    with Session(engine) as session:
        assert len(session.exec(select(AdvertiseEnquiry).where(AdvertiseEnquiry.blog_id == blog_id)).all()) == 2


def test_enquiries_are_refused_while_the_page_is_off(client, sent):
    _, blog_id, _, _ = _register(client)

    res = client.post(f"/blogs/{blog_id}/advertise/enquiry", json={"name": "B", "email": "b@x.example", "message": "Hi"})

    assert res.status_code == 404
    assert sent == []
