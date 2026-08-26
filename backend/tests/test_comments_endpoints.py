"""
Comment endpoint coverage:

- `comments_enabled` on the owning blog is enforced when creating a comment
  (it previously existed on the model but was never read).
- The public subdomain-resolution endpoint stops resolving a deactivated blog.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models import Post
from app.models.post import PostStatus


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[str, int, int]:
    """Registers a brand-new user + workspace, returns (access_token, blog_id, user_id)."""
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


def _create_post(blog_id: int, author_id: int) -> int:
    """
    Inserted directly rather than via POST /blogs/{blog_id}/posts/, since that
    route requires onboarding to be complete — irrelevant to what these tests
    are checking (comment creation against an existing post).
    """
    with Session(engine) as session:
        post = Post(
            title=f"Post {uuid.uuid4().hex[:8]}",
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            status=PostStatus.PUBLISHED,
            published=True,
        )
        session.add(post)
        session.commit()
        session.refresh(post)
        return post.id


def test_creating_a_comment_succeeds_when_comments_are_enabled(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    res = client.post("/comments/", json={"content": "Nice post!", "post_id": post_id}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["content"] == "Nice post!"


def test_comment_response_does_not_expose_commenter_account_details(client):
    """
    CommentRead.user used to embed the full UserRead — email, platform_role,
    is_super_admin, blog_memberships — on every publicly-readable comment.
    """
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    res = client.post("/comments/", json={"content": "Hello", "post_id": post_id}, headers=headers)
    assert res.status_code == 200, res.text
    user_payload = res.json()["user"]

    assert set(user_payload.keys()) == {"id", "username", "first_name", "last_name"}


def test_creating_a_comment_is_blocked_when_comments_are_disabled(client):
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    disable = client.put(
        f"/blogs/{blog_id}/onboarding/publication",
        json={
            "default_post_visibility": "public",
            "comments_enabled": False,
            "posts_per_page": 10,
            "timezone": "UTC",
        },
        headers=headers,
    )
    assert disable.status_code == 200, disable.text

    res = client.post("/comments/", json={"content": "Should be blocked", "post_id": post_id}, headers=headers)
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "OPERATION_NOT_ALLOWED"


def test_listing_comments_still_works_when_comments_are_disabled(client):
    """Disabling comments stops new ones, but shouldn't hide the existing thread."""
    token, blog_id, user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}
    post_id = _create_post(blog_id, user_id)

    posted = client.post("/comments/", json={"content": "Before disabling", "post_id": post_id}, headers=headers)
    assert posted.status_code == 200, posted.text

    client.put(
        f"/blogs/{blog_id}/onboarding/publication",
        json={
            "default_post_visibility": "public",
            "comments_enabled": False,
            "posts_per_page": 10,
            "timezone": "UTC",
        },
        headers=headers,
    )

    res = client.get(f"/comments/post/{post_id}")
    assert res.status_code == 200, res.text
    assert any(c["content"] == "Before disabling" for c in res.json())


def test_subdomain_lookup_finds_an_active_blog(client):
    token, blog_id, _user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/blogs/me", headers=headers)
    assert me.status_code == 200, me.text
    subdomain = next(b["subdomain"] for b in me.json() if b["id"] == blog_id)

    res = client.get(f"/blogs/by-subdomain/{subdomain}")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == blog_id


def test_subdomain_lookup_404s_once_the_blog_is_deactivated(client):
    from app.models import Blog

    token, blog_id, _user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/blogs/me", headers=headers)
    subdomain = next(b["subdomain"] for b in me.json() if b["id"] == blog_id)

    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.is_active = False
        session.add(blog)
        session.commit()

    res = client.get(f"/blogs/by-subdomain/{subdomain}")
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "BLOG_NOT_FOUND"
