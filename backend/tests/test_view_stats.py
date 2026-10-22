"""
View stats: what counts as a view (readers only — not the team, crawlers or
unpublished posts), the daily counters behind it, and the studio's analytics
report with its author scoping and plan history window.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import BlogMember, BlogRole, BlogSubscription, BlogVisitorDaily, Post, PostViewDaily, SubscriptionPlan
from app.models.post import PostStatus

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
    # Later requests act as an anonymous reader unless they pass `headers`.
    client.cookies.clear()
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _create_post(blog_id: int, author_id: int, status: PostStatus = PostStatus.PUBLISHED) -> int:
    with Session(engine) as session:
        post = Post(
            title=f"Post {uuid.uuid4().hex[:8]}",
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            status=status,
            published=status == PostStatus.PUBLISHED,
            published_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        session.add(post)
        session.commit()
        return post.id


def _view(client, blog_id: int, post_id: int, new_visitor: bool = False, headers: dict | None = None):
    return client.post(
        f"/blogs/{blog_id}/posts/{post_id}/view",
        json={"new_visitor": new_visitor},
        headers={"User-Agent": BROWSER_UA, **(headers or {})},
    )


def _views_today(post_id: int) -> int:
    today = datetime.now(timezone.utc).date()
    with Session(engine) as session:
        row = session.exec(
            select(PostViewDaily).where(PostViewDaily.post_id == post_id, PostViewDaily.day == today)
        ).first()
        return row.views if row else 0


def _set_plan(blog_id: int, plan: SubscriptionPlan) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.status = "active"
        session.add(subscription)
        session.commit()


# ── Recording ────────────────────────────────────────────────────────────────

def test_reader_views_are_counted_per_day_and_in_the_lifetime_total(client):
    _, blog_id, user_id = _register(client)
    post_id = _create_post(blog_id, user_id)

    for _ in range(3):
        assert _view(client, blog_id, post_id).status_code == 204

    assert _views_today(post_id) == 3
    with Session(engine) as session:
        assert session.get(Post, post_id).views == 3


def test_new_visitors_are_counted_per_blog_per_day(client):
    _, blog_id, user_id = _register(client)
    first, second = _create_post(blog_id, user_id), _create_post(blog_id, user_id)

    _view(client, blog_id, first, new_visitor=True)
    _view(client, blog_id, second, new_visitor=False)
    _view(client, blog_id, second, new_visitor=True)

    today = datetime.now(timezone.utc).date()
    with Session(engine) as session:
        row = session.exec(
            select(BlogVisitorDaily).where(BlogVisitorDaily.blog_id == blog_id, BlogVisitorDaily.day == today)
        ).one()
        assert row.visitors == 2


def test_team_members_viewing_their_own_blog_are_not_counted(client):
    headers, blog_id, user_id = _register(client)
    post_id = _create_post(blog_id, user_id)

    assert _view(client, blog_id, post_id, headers=headers).status_code == 204

    assert _views_today(post_id) == 0


def test_crawlers_and_missing_user_agents_are_not_counted(client):
    _, blog_id, user_id = _register(client)
    post_id = _create_post(blog_id, user_id)

    for agent in ("Googlebot/2.1 (+http://www.google.com/bot.html)", "facebookexternalhit/1.1", "curl/8.4.0", ""):
        res = client.post(f"/blogs/{blog_id}/posts/{post_id}/view", json={}, headers={"User-Agent": agent})
        assert res.status_code == 204

    assert _views_today(post_id) == 0


def test_unpublished_and_other_blogs_posts_are_not_found(client):
    _, blog_id, user_id = _register(client)
    _, other_blog_id, other_user_id = _register(client)
    draft_id = _create_post(blog_id, user_id, status=PostStatus.DRAFT)
    other_post_id = _create_post(other_blog_id, other_user_id)

    assert _view(client, blog_id, draft_id).status_code == 404
    assert _view(client, blog_id, other_post_id).status_code == 404
    assert _views_today(draft_id) == 0


def test_reading_a_post_no_longer_counts_a_view(client):
    _, blog_id, user_id = _register(client)
    post_id = _create_post(blog_id, user_id)
    with Session(engine) as session:
        slug = session.get(Post, post_id).slug

    assert client.get(f"/blogs/{blog_id}/posts/slug/{slug}").status_code == 200

    assert _views_today(post_id) == 0
    with Session(engine) as session:
        assert session.get(Post, post_id).views == 0


# ── Reporting ────────────────────────────────────────────────────────────────

def test_analytics_reports_daily_series_totals_and_top_posts(client):
    headers, blog_id, user_id = _register(client)
    popular, quiet = _create_post(blog_id, user_id), _create_post(blog_id, user_id)
    for _ in range(3):
        _view(client, blog_id, popular)
    _view(client, blog_id, quiet, new_visitor=True)

    res = client.get(f"/blogs/{blog_id}/analytics", params={"range": "7d"}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()

    assert len(body["days"]) == 7
    assert body["days"][-1]["day"] == datetime.now(timezone.utc).date().isoformat()
    assert body["days"][-1] == {"day": body["days"][-1]["day"], "views": 4, "visitors": 1}
    assert body["total_views"] == 4
    assert body["total_visitors"] == 1
    assert [p["id"] for p in body["top_posts"]] == [popular, quiet]
    assert [p["views"] for p in body["top_posts"]] == [3, 1]


def test_authors_see_only_their_own_posts_and_no_visitors(client):
    owner_headers, blog_id, owner_id = _register(client)
    author_headers, _, author_id = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(blog_id=blog_id, user_id=author_id, role=BlogRole.AUTHOR))
        session.commit()
    owners_post, authors_post = _create_post(blog_id, owner_id), _create_post(blog_id, author_id)
    _view(client, blog_id, owners_post, new_visitor=True)
    _view(client, blog_id, authors_post)

    body = client.get(f"/blogs/{blog_id}/analytics", params={"range": "7d"}, headers=author_headers).json()

    assert body["total_views"] == 1
    assert [p["id"] for p in body["top_posts"]] == [authors_post]
    assert body["total_visitors"] is None
    assert all(day["visitors"] is None for day in body["days"])


def test_free_plan_is_limited_to_30_days_of_history(client):
    headers, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.FREE)

    ok = client.get(f"/blogs/{blog_id}/analytics", params={"range": "30d"}, headers=headers)
    assert ok.status_code == 200
    assert ok.json()["history_days"] == 30

    refused = client.get(f"/blogs/{blog_id}/analytics", params={"range": "90d"}, headers=headers)
    assert refused.status_code == 403
    assert refused.json()["code"] == "PLAN_UPGRADE_REQUIRED"


def test_paid_plans_get_a_year_of_history(client):
    headers, blog_id, _ = _register(client)
    _set_plan(blog_id, SubscriptionPlan.PRO)

    res = client.get(f"/blogs/{blog_id}/analytics", params={"range": "12m"}, headers=headers)

    assert res.status_code == 200, res.text
    days = res.json()["days"]
    # Eleven whole months back plus this month so far.
    first, last = days[0]["day"], days[-1]["day"]
    assert first.endswith("-01")
    assert (int(last[:4]) * 12 + int(last[5:7])) - (int(first[:4]) * 12 + int(first[5:7])) == 11


def test_analytics_is_for_members_only(client):
    _, blog_id, _ = _register(client)
    outsider_headers, _, _ = _register(client)

    res = client.get(f"/blogs/{blog_id}/analytics", headers=outsider_headers)

    assert res.status_code == 403
