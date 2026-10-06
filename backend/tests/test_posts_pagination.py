"""
Pagination coverage for the Phase 2 fix to `read_posts`/`search_posts`:
both previously returned the entire result set unordered and unpaginated.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Post, Tag, User
from app.models.post import PostStatus
from app.modules.posts import service as post_service
from app.schemas import PostUpdate


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
    return client.cookies.get(ACCESS_TOKEN_COOKIE_NAME), body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


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


def _create_post_with_status(blog_id: int, author_id: int, title: str, status: PostStatus) -> int:
    with Session(engine) as session:
        post = Post(
            title=title,
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            status=status,
            published=status == PostStatus.PUBLISHED,
        )
        session.add(post)
        session.commit()
        session.refresh(post)
        return post.id


def test_status_filter_on_posts_endpoint(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    _create_post_with_status(blog_id, user_id, "A draft", PostStatus.DRAFT)
    _create_post_with_status(blog_id, user_id, "A live post", PostStatus.PUBLISHED)

    res = client.get(f"/blogs/{blog_id}/posts/?status=draft", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["status"] == "draft"


def test_q_filter_on_posts_endpoint(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    _create_post_with_status(blog_id, user_id, "Unique Zebra Title", PostStatus.PUBLISHED)
    _create_post_with_status(blog_id, user_id, "Something else entirely", PostStatus.PUBLISHED)

    res = client.get(f"/blogs/{blog_id}/posts/?q=Zebra", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Unique Zebra Title"


def test_post_counts_endpoint_reflects_all_statuses(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    _create_post_with_status(blog_id, user_id, "Draft one", PostStatus.DRAFT)
    _create_post_with_status(blog_id, user_id, "Draft two", PostStatus.DRAFT)
    _create_post_with_status(blog_id, user_id, "Scheduled one", PostStatus.SCHEDULED)
    _create_post_with_status(blog_id, user_id, "Live one", PostStatus.PUBLISHED)

    res = client.get(f"/blogs/{blog_id}/posts/counts", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == {"all": 4, "published": 1, "scheduled": 1, "draft": 2}


def test_post_counts_endpoint_requires_author_access(client):
    _, blog_id, _ = _register_owner(client)

    # Registering set the owner's session as cookies on this client — clear
    # them so the request genuinely carries no credentials, the same as it
    # would have with no Authorization header before cookie-based auth.
    client.cookies.clear()
    res = client.get(f"/blogs/{blog_id}/posts/counts")
    assert res.status_code == 401


# update_post's HTTP route additionally requires completed onboarding
# (require_completed_onboarding); driving these through the router would mean
# onboarding a whole workspace just to reach logic that doesn't touch that at
# all, so — matching the upload_post_image tests above — these call the
# service function directly instead.

def _feature_post(blog_id: int, post_id: int, user_id: int) -> None:
    with Session(engine) as session:
        user = session.get(User, user_id)
        post_service.update_post(blog_id, post_id, PostUpdate(is_featured=True), session, user)


def test_featured_post_sorts_first_regardless_of_recency(client):
    """A manually-featured post outranks newer posts — it's what lets the
    homepage's `filteredPosts[0]` pick it as the hero regardless of age."""
    _, blog_id, user_id = _register_owner(client)
    old_ids = _create_posts(blog_id, user_id, 3)
    oldest_id = old_ids[0]

    _feature_post(blog_id, oldest_id, user_id)

    res = client.get(f"/blogs/{blog_id}/posts/?limit=10")
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert items[0]["id"] == oldest_id
    assert items[0]["is_featured"] is True


def test_setting_a_post_featured_unfeatures_the_others(client):
    _, blog_id, user_id = _register_owner(client)
    first_id, second_id = _create_posts(blog_id, user_id, 2)

    _feature_post(blog_id, first_id, user_id)
    _feature_post(blog_id, second_id, user_id)

    res = client.get(f"/blogs/{blog_id}/posts/?limit=10")
    featured_flags = {p["id"]: p["is_featured"] for p in res.json()["items"]}
    assert featured_flags[first_id] is False
    assert featured_flags[second_id] is True
