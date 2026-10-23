"""
The studio's Analytics page: traffic sources from the first view of a visit,
the overview (totals, previous-period comparison within the plan's history,
follower series, sources, posts that brought followers), the post table, the
Pro+ export, and who may see it.
"""

import csv
import io
import uuid
from datetime import datetime, time, timedelta, timezone

import pytest
from sqlmodel import Session, select

from app.core.datetimes import utc_now
from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import (
    AuditLog,
    BlogFollower,
    BlogMember,
    BlogRole,
    BlogSourceDaily,
    BlogSubscription,
    BlogVisitorDaily,
    FollowerStatus,
    Post,
    PostViewDaily,
    SubscriptionPlan,
)
from app.models.post import PostStatus
from app.modules.analytics.sources import classify_referrer

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"


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
    client.cookies.clear()
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _join(client, blog_id: int, role: BlogRole) -> dict:
    headers, _, user_id = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(blog_id=blog_id, user_id=user_id, role=role))
        session.commit()
    return headers


def _set_plan(blog_id: int, plan: SubscriptionPlan) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.status = "active"
        session.add(subscription)
        session.commit()


def _post(blog_id: int, user_id: int, title: str = "Post", days_ago: int = 1, views: int = 0) -> int:
    with Session(engine) as session:
        post = Post(
            title=title, slug=f"post-{uuid.uuid4().hex[:8]}", content="Body", blog_id=blog_id, author_id=user_id,
            status=PostStatus.PUBLISHED, published=True, views=views,
            published_at=utc_now() - timedelta(days=days_ago),
        )
        session.add(post)
        session.commit()
        return post.id


def _today():
    return utc_now().date()


def _at(days_ago: int) -> datetime:
    return datetime.combine(_today() - timedelta(days=days_ago), time(12), tzinfo=timezone.utc)


def _seed(blog_id: int, rows: list) -> None:
    with Session(engine) as session:
        session.add_all(rows)
        session.commit()


def _follower(blog_id: int, confirmed_days_ago: int, source_post_id=None, unsubscribed_days_ago=None) -> BlogFollower:
    return BlogFollower(
        blog_id=blog_id,
        email=f"r-{uuid.uuid4().hex[:10]}@example.com",
        status=FollowerStatus.UNSUBSCRIBED if unsubscribed_days_ago is not None else FollowerStatus.ACTIVE,
        source_post_id=source_post_id,
        confirmed_at=_at(confirmed_days_ago),
        unsubscribed_at=_at(unsubscribed_days_ago) if unsubscribed_days_ago is not None else None,
    )


# ── Traffic sources ──────────────────────────────────────────────────────────

@pytest.mark.parametrize(("referrer", "source"), [
    ("", "Direct"),
    (None, "Direct"),
    ("https://www.google.com.ng/search?q=naija+recipes", "Google"),
    ("https://l.wl.co/l?u=https://blog", "WhatsApp"),
    ("android-app://com.whatsapp/", "WhatsApp"),
    ("https://t.co/AbC123", "X"),
    ("https://l.facebook.com/l.php?u=x", "Facebook"),
    ("https://www.nairaland.com/7000000/thread", "nairaland.com"),
    ("https://myblog.inko.blog/post/older", "Direct"),
    ("javascript:alert(1)", "Other"),
    ("not a url at all", "Other"),
])
def test_referrers_are_classified_to_a_source(referrer, source):
    assert classify_referrer(referrer, ["myblog.inko.blog"]) == source


def test_a_source_is_counted_only_with_the_first_view_of_a_visit(client):
    _, blog_id, user_id = _register(client)
    post_id = _post(blog_id, user_id)
    url = f"/blogs/{blog_id}/posts/{post_id}/view"
    headers = {"User-Agent": BROWSER_UA}

    client.post(url, json={"new_visitor": True, "referrer": "https://www.google.com/"}, headers=headers)
    client.post(url, json={"referrer": ""}, headers=headers)
    client.post(url, json={}, headers=headers)  # a later page in the same visit: no referrer

    with Session(engine) as session:
        rows = {
            row.source: row.visits
            for row in session.exec(select(BlogSourceDaily).where(BlogSourceDaily.blog_id == blog_id)).all()
        }
    assert rows == {"Google": 1, "Direct": 1}


# ── Overview ─────────────────────────────────────────────────────────────────

def test_overview_totals_series_sources_and_follower_posts(client):
    owner, blog_id, user_id = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    hit = _post(blog_id, user_id, title="Hit")
    today = _today()
    _seed(blog_id, [
        PostViewDaily(blog_id=blog_id, post_id=hit, day=today, views=10),
        PostViewDaily(blog_id=blog_id, post_id=hit, day=today - timedelta(days=2), views=5),
        BlogVisitorDaily(blog_id=blog_id, day=today, visitors=6),
        BlogSourceDaily(blog_id=blog_id, day=today, source="WhatsApp", visits=4),
        BlogSourceDaily(blog_id=blog_id, day=today, source="Google", visits=2),
        _follower(blog_id, 0, source_post_id=hit),
        _follower(blog_id, 1, source_post_id=hit),
        _follower(blog_id, 2, unsubscribed_days_ago=0),
        # Outside the 7-day range: not counted.
        PostViewDaily(blog_id=blog_id, post_id=hit, day=today - timedelta(days=20), views=99),
    ])

    res = client.get(f"/blogs/{blog_id}/analytics/overview", params={"range": "7d"}, headers=owner)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["totals"] == {"views": 15, "visitors": 6, "new_followers": 3, "unsubscribes": 1}
    assert len(body["days"]) == 7
    assert body["days"][-1] == {
        "day": today.isoformat(), "views": 10, "visitors": 6, "new_followers": 1, "unsubscribes": 1,
    }
    assert body["sources"] == [{"source": "WhatsApp", "visits": 4}, {"source": "Google", "visits": 2}]
    assert body["follower_posts"][0]["id"] == hit and body["follower_posts"][0]["followers"] == 2
    assert body["can_export"] is True


def test_previous_period_is_compared_only_within_the_plans_history(client):
    owner, blog_id, user_id = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)
    post_id = _post(blog_id, user_id)
    _seed(blog_id, [PostViewDaily(blog_id=blog_id, post_id=post_id, day=_today() - timedelta(days=9), views=7)])

    week = client.get(f"/blogs/{blog_id}/analytics/overview", params={"range": "7d"}, headers=owner).json()
    month = client.get(f"/blogs/{blog_id}/analytics/overview", params={"range": "30d"}, headers=owner).json()

    # Free keeps 30 days: the 7 days before this week fit, the 30 before this month don't.
    assert week["previous_totals"]["views"] == 7
    assert month["previous_totals"] is None
    assert month["can_export"] is False


def test_ranges_beyond_the_plans_history_are_refused(client):
    owner, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)

    res = client.get(f"/blogs/{blog_id}/analytics/overview", params={"range": "90d"}, headers=owner)

    assert res.status_code == 403
    assert res.json()["code"] == "PLAN_UPGRADE_REQUIRED"


# ── Post table ───────────────────────────────────────────────────────────────

def test_post_table_sorts_and_pages(client):
    owner, blog_id, user_id = _register(client)
    read = _post(blog_id, user_id, title="Read", days_ago=5, views=500)
    followed = _post(blog_id, user_id, title="Followed", days_ago=3, views=20)
    newest = _post(blog_id, user_id, title="Newest", days_ago=0)
    today = _today()
    _seed(blog_id, [
        PostViewDaily(blog_id=blog_id, post_id=read, day=today, views=40),
        PostViewDaily(blog_id=blog_id, post_id=followed, day=today, views=10),
        _follower(blog_id, 0, source_post_id=followed),
        _follower(blog_id, 1, source_post_id=followed),
    ])
    url = f"/blogs/{blog_id}/analytics/posts"

    by_views = client.get(url, params={"range": "7d"}, headers=owner).json()
    by_followers = client.get(url, params={"range": "7d", "sort": "followers"}, headers=owner).json()
    by_newest = client.get(url, params={"range": "7d", "sort": "newest", "limit": 1}, headers=owner).json()

    assert [p["id"] for p in by_views["items"]][:2] == [read, followed]
    assert by_views["items"][0]["views_in_range"] == 40 and by_views["items"][0]["lifetime_views"] == 500
    assert by_followers["items"][0]["id"] == followed and by_followers["items"][0]["followers_gained"] == 2
    assert [p["id"] for p in by_newest["items"]] == [newest]
    assert by_newest["has_more"] is True


# ── Export ───────────────────────────────────────────────────────────────────

def test_pro_exports_daily_rows_and_it_is_logged(client):
    owner, blog_id, user_id = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)
    post_id = _post(blog_id, user_id)
    _seed(blog_id, [PostViewDaily(blog_id=blog_id, post_id=post_id, day=_today(), views=3)])

    res = client.get(f"/blogs/{blog_id}/analytics/export", params={"range": "7d"}, headers=owner)

    assert res.status_code == 200, res.text
    assert "attachment" in res.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(res.text)))
    assert rows[0] == ["date", "views", "visitors", "new_followers", "unsubscribes"]
    assert len(rows) == 8
    assert rows[-1][:2] == [_today().isoformat(), "3"]
    with Session(engine) as session:
        assert session.exec(
            select(AuditLog).where(AuditLog.action == "analytics.export", AuditLog.blog_id == blog_id)
        ).first() is not None


def test_free_cant_export(client):
    owner, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)

    res = client.get(f"/blogs/{blog_id}/analytics/export", params={"range": "7d"}, headers=owner)

    assert res.status_code == 403
    assert res.json()["code"] == "PLAN_UPGRADE_REQUIRED"


# ── Access ───────────────────────────────────────────────────────────────────

def test_owners_and_editors_see_the_page_authors_and_outsiders_dont(client):
    owner, blog_id, _ = _register(client)
    editor = _join(client, blog_id, BlogRole.EDITOR)
    author = _join(client, blog_id, BlogRole.AUTHOR)
    outsider, _, _ = _register(client)

    for headers in (owner, editor):
        assert client.get(f"/blogs/{blog_id}/analytics/overview", headers=headers).status_code == 200
        assert client.get(f"/blogs/{blog_id}/analytics/posts", headers=headers).status_code == 200
    for headers in (author, outsider):
        assert client.get(f"/blogs/{blog_id}/analytics/overview", headers=headers).status_code == 403
        assert client.get(f"/blogs/{blog_id}/analytics/posts", headers=headers).status_code == 403
