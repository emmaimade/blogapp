"""
Pagination coverage for the Phase 2 fix to `read_posts`/`search_posts`:
both previously returned the entire result set unordered and unpaginated.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models import Post, Tag
from app.models.post import PostStatus


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[str, int, int]:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": _unique_email(),
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["access_token"], body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _create_posts(blog_id: int, author_id: int, count: int, views: list[int] | None = None, tag_name: str | None = None) -> list[int]:
    with Session(engine) as session:
        tag = None
        if tag_name:
            tag = Tag(name=tag_name, blog_id=blog_id)
            session.add(tag)
            session.flush()

        ids = []
        for i in range(count):
            post = Post(
                title=f"Post {uuid.uuid4().hex[:8]}",
                slug=f"post-{uuid.uuid4().hex[:8]}",
                content="Body content.",
                blog_id=blog_id,
                author_id=author_id,
                status=PostStatus.PUBLISHED,
                published=True,
                views=views[i] if views else 0,
            )
            if tag:
                post.tags = [tag]
            session.add(post)
            session.flush()
            ids.append(post.id)
        session.commit()
        return ids


def test_first_page_returns_limit_items_and_has_more(client):
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 15)

    res = client.get(f"/blogs/{blog_id}/posts/?skip=0&limit=12")
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["items"]) == 12
    assert body["total"] == 15
    assert body["skip"] == 0
    assert body["limit"] == 12
    assert body["has_more"] is True


def test_second_page_returns_remainder_and_no_more(client):
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 15)

    res = client.get(f"/blogs/{blog_id}/posts/?skip=12&limit=12")
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["items"]) == 3
    assert body["total"] == 15
    assert body["has_more"] is False


def test_pages_do_not_overlap(client):
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 15)

    first = client.get(f"/blogs/{blog_id}/posts/?skip=0&limit=12").json()
    second = client.get(f"/blogs/{blog_id}/posts/?skip=12&limit=12").json()
    first_ids = {p["id"] for p in first["items"]}
    second_ids = {p["id"] for p in second["items"]}
    assert first_ids.isdisjoint(second_ids)
    assert len(first_ids) + len(second_ids) == 15


def test_sort_popular_orders_by_views_descending(client):
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 4, views=[10, 50, 5, 30])

    res = client.get(f"/blogs/{blog_id}/posts/?sort=popular&limit=10")
    assert res.status_code == 200, res.text
    views = [p["views"] for p in res.json()["items"]]
    assert views == sorted(views, reverse=True)


def test_tag_filter_on_posts_endpoint(client):
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 3, tag_name="python")
    _create_posts(blog_id, user_id, 2)  # untagged

    res = client.get(f"/blogs/{blog_id}/posts/?tag=python&limit=10")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 3
    assert all(any(t["name"] == "python" for t in p["tags"]) for p in body["items"])


def test_limit_100_is_accepted(client):
    """
    PostDetail.tsx's sidebar/related-posts fetch requests limit=100 — the
    router's ceiling must allow it, not just the default page size (12).
    """
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 3)

    res = client.get(f"/blogs/{blog_id}/posts/?limit=100")
    assert res.status_code == 200, res.text

    res = client.get(f"/blogs/{blog_id}/posts/?limit=101")
    assert res.status_code == 422


def test_post_author_does_not_expose_account_details(client):
    """
    PostRead.author used to embed the full UserRead — email, platform_role,
    is_super_admin, blog_memberships — on every publicly-readable post.
    """
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 1)

    res = client.get(f"/blogs/{blog_id}/posts/?limit=1")
    assert res.status_code == 200, res.text
    author_payload = res.json()["items"][0]["author"]

    assert set(author_payload.keys()) == {"id", "username", "first_name", "last_name"}


def test_search_endpoint_is_paginated(client):
    _, blog_id, user_id = _register_owner(client)
    _create_posts(blog_id, user_id, 15, tag_name="react")

    res = client.get(f"/blogs/{blog_id}/posts/search?tag=react&skip=0&limit=12")
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["items"]) == 12
    assert body["total"] == 15
    assert body["has_more"] is True
