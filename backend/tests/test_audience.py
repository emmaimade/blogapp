"""
The studio's Audience page: who may see and manage a blog's followers, the
summary and list, removing (a full delete), the CSV export and the editor
permission that unlocks it, and the follow form's on/off switch.
"""

import csv
import io
import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import AuditLog, Blog, BlogFollower, BlogMember, BlogRole, BlogSubscription, FollowerStatus, Post, SubscriptionPlan
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
    client.cookies.clear()
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _join(client, blog_id: int, role: BlogRole) -> tuple[dict, int]:
    """A second person joining the blog with `role`; returns their headers and membership id."""
    headers, _, user_id = _register(client)
    with Session(engine) as session:
        member = BlogMember(blog_id=blog_id, user_id=user_id, role=role)
        session.add(member)
        session.commit()
        return headers, member.id


def _set_pro(blog_id: int) -> None:
    """Room for more than one member: on Free, a second member is paused (read-only)."""
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = SubscriptionPlan.PRO
        subscription.status = "active"
        session.add(subscription)
        session.commit()


def _add_follower(blog_id: int, email: str | None = None, status=FollowerStatus.ACTIVE, source_post_id=None) -> int:
    with Session(engine) as session:
        follower = BlogFollower(
            blog_id=blog_id,
            email=email or f"reader-{uuid.uuid4().hex[:10]}@example.com",
            status=status,
            source_post_id=source_post_id,
        )
        session.add(follower)
        session.commit()
        return follower.id


# ── Access ───────────────────────────────────────────────────────────────────

def test_owners_and_editors_see_the_audience_authors_and_outsiders_dont(client):
    owner, blog_id, _ = _register(client)
    editor, _ = _join(client, blog_id, BlogRole.EDITOR)
    author, _ = _join(client, blog_id, BlogRole.AUTHOR)
    outsider, _, _ = _register(client)

    for headers in (owner, editor):
        assert client.get(f"/blogs/{blog_id}/followers", headers=headers).status_code == 200
        assert client.get(f"/blogs/{blog_id}/followers/summary", headers=headers).status_code == 200
    for headers in (author, outsider):
        assert client.get(f"/blogs/{blog_id}/followers", headers=headers).status_code == 403
        assert client.get(f"/blogs/{blog_id}/followers/summary", headers=headers).status_code == 403


# ── Summary and list ─────────────────────────────────────────────────────────

def test_summary_counts_each_status_and_shows_the_plan_limit(client):
    owner, blog_id, _ = _register(client)
    for status, count in ((FollowerStatus.ACTIVE, 3), (FollowerStatus.PENDING, 2), (FollowerStatus.UNSUBSCRIBED, 1)):
        for _ in range(count):
            _add_follower(blog_id, status=status)

    body = client.get(f"/blogs/{blog_id}/followers/summary", headers=owner).json()

    assert (body["active"], body["pending"], body["unsubscribed"]) == (3, 2, 1)
    assert body["followers_enabled"] is True
    assert body["can_export"] is True
    assert "max_followers" in body


def test_list_filters_by_status_searches_by_email_and_shows_the_source_post(client):
    owner, blog_id, user_id = _register(client)
    with Session(engine) as session:
        post = Post(title="Origin", slug=f"origin-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id,
                    author_id=user_id, status=PostStatus.PUBLISHED, published=True)
        session.add(post)
        session.commit()
        post_id = post.id
    _add_follower(blog_id, email="ngozi@example.com", source_post_id=post_id)
    _add_follower(blog_id, email="tunde@example.com", status=FollowerStatus.PENDING)

    active = client.get(f"/blogs/{blog_id}/followers", params={"status": "active"}, headers=owner).json()
    searched = client.get(f"/blogs/{blog_id}/followers", params={"q": "TUNDE"}, headers=owner).json()

    assert [f["email"] for f in active["items"]] == ["ngozi@example.com"]
    assert active["items"][0]["source_post"] == {"id": post_id, "title": "Origin", "slug": post.slug}
    assert [f["email"] for f in searched["items"]] == ["tunde@example.com"]
    assert searched["total"] == 1


# ── Removing ─────────────────────────────────────────────────────────────────

def test_removing_deletes_the_follower_and_logs_a_masked_email(client):
    _, blog_id, _ = _register(client)
    _set_pro(blog_id)
    editor, _ = _join(client, blog_id, BlogRole.EDITOR)
    follower_id = _add_follower(blog_id, email="chioma@example.com", status=FollowerStatus.UNSUBSCRIBED)

    res = client.delete(f"/blogs/{blog_id}/followers/{follower_id}", headers=editor)

    assert res.status_code == 204
    with Session(engine) as session:
        assert session.get(BlogFollower, follower_id) is None
        entry = session.exec(
            select(AuditLog).where(AuditLog.action == "follower.remove", AuditLog.resource_id == follower_id)
        ).one()
        assert "chioma@" not in str(entry.details)
        assert "ch***@example.com" in str(entry.details)


def test_a_follower_of_another_blog_cant_be_removed(client):
    owner, blog_id, _ = _register(client)
    _, other_blog_id, _ = _register(client)
    follower_id = _add_follower(other_blog_id)

    res = client.delete(f"/blogs/{blog_id}/followers/{follower_id}", headers=owner)

    assert res.status_code == 404
    with Session(engine) as session:
        assert session.get(BlogFollower, follower_id) is not None


# ── Export ───────────────────────────────────────────────────────────────────

def test_the_owner_exports_a_csv_with_formulas_neutralised(client):
    owner, blog_id, _ = _register(client)
    _add_follower(blog_id, email="=cmd@example.com")
    _add_follower(blog_id, email="plain@example.com", status=FollowerStatus.PENDING)

    res = client.get(f"/blogs/{blog_id}/followers/export", params={"status": "active"}, headers=owner)

    assert res.status_code == 200, res.text
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(res.text)))
    assert rows[0] == ["email", "status", "followed_utc", "confirmed_utc", "unsubscribed_utc", "source_post"]
    assert [row[0] for row in rows[1:]] == ["'=cmd@example.com"]
    with Session(engine) as session:
        assert session.exec(
            select(AuditLog).where(AuditLog.action == "follower.export", AuditLog.blog_id == blog_id)
        ).first() is not None


def test_editors_export_only_once_the_owner_allows_it(client):
    owner, blog_id, _ = _register(client)
    editor, member_id = _join(client, blog_id, BlogRole.EDITOR)
    _add_follower(blog_id)

    assert client.get(f"/blogs/{blog_id}/followers/export", headers=editor).status_code == 403
    assert client.get(f"/blogs/{blog_id}/followers/summary", headers=editor).json()["can_export"] is False

    granted = client.patch(
        f"/blogs/{blog_id}/members/{member_id}", json={"permissions": {"export_followers": True}}, headers=owner,
    )
    assert granted.status_code == 200, granted.text
    assert granted.json()["permissions"] == {"export_followers": True}
    assert client.get(f"/blogs/{blog_id}/followers/export", headers=editor).status_code == 200
    assert client.get(f"/blogs/{blog_id}/followers/summary", headers=editor).json()["can_export"] is True

    client.patch(f"/blogs/{blog_id}/members/{member_id}", json={"permissions": {"export_followers": False}}, headers=owner)
    assert client.get(f"/blogs/{blog_id}/followers/export", headers=editor).status_code == 403


def test_authors_cant_export_even_with_the_permission_key(client):
    owner, blog_id, _ = _register(client)
    author, member_id = _join(client, blog_id, BlogRole.AUTHOR)

    res = client.patch(
        f"/blogs/{blog_id}/members/{member_id}", json={"permissions": {"export_followers": True}}, headers=owner,
    )

    assert res.status_code == 400
    assert client.get(f"/blogs/{blog_id}/followers/export", headers=author).status_code == 403


# ── Member permissions ───────────────────────────────────────────────────────

def test_unknown_permission_keys_are_rejected(client):
    owner, blog_id, _ = _register(client)
    _, member_id = _join(client, blog_id, BlogRole.EDITOR)

    res = client.patch(
        f"/blogs/{blog_id}/members/{member_id}", json={"permissions": {"delete_everything": True}}, headers=owner,
    )

    assert res.status_code == 422
    with Session(engine) as session:
        assert session.get(BlogMember, member_id).permissions == {}


def test_only_the_owner_grants_permissions(client):
    _, blog_id, _ = _register(client)
    editor, editor_member_id = _join(client, blog_id, BlogRole.EDITOR)

    res = client.patch(
        f"/blogs/{blog_id}/members/{editor_member_id}", json={"permissions": {"export_followers": True}}, headers=editor,
    )

    assert res.status_code == 403


def test_moving_an_editor_to_author_drops_their_permissions(client):
    owner, blog_id, _ = _register(client)
    _, member_id = _join(client, blog_id, BlogRole.EDITOR)
    client.patch(f"/blogs/{blog_id}/members/{member_id}", json={"permissions": {"export_followers": True}}, headers=owner)

    res = client.patch(f"/blogs/{blog_id}/members/{member_id}", json={"role": "author"}, headers=owner)

    assert res.status_code == 200, res.text
    assert res.json()["permissions"] == {}


# ── Follow form switch ───────────────────────────────────────────────────────

def test_turning_the_follow_form_off_blocks_new_followers_and_shows_on_the_blog(client):
    owner, blog_id, _ = _register(client)
    existing = _add_follower(blog_id)

    res = client.patch(f"/blogs/{blog_id}/followers/settings", json={"followers_enabled": False}, headers=owner)
    assert res.status_code == 200
    assert res.json() == {"followers_enabled": False}

    follow = client.post(f"/blogs/{blog_id}/followers", json={"email": "new@example.com"})
    assert follow.status_code == 403
    assert follow.json()["code"] == "FOLLOWING_DISABLED"
    with Session(engine) as session:
        assert session.get(BlogFollower, existing) is not None
        slug = session.get(Blog, blog_id).subdomain
    resolved = client.get("/blogs/resolve", params={"host": f"{slug}.inko.blog"})
    assert resolved.json()["followers_enabled"] is False


def test_only_the_owner_flips_the_switch(client):
    _, blog_id, _ = _register(client)
    editor, _ = _join(client, blog_id, BlogRole.EDITOR)

    res = client.patch(f"/blogs/{blog_id}/followers/settings", json={"followers_enabled": False}, headers=editor)

    assert res.status_code == 403
