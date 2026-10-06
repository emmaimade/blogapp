"""
`/blogs/{id}/tags/popular` feeds the public blog footer's Topics column.

It used to 500 as soon as any published post carried a tag: `PopularTagRead`
inherits a required `blog_id` from `TagRead` that the endpoint never passed,
so the bug only surfaced once there were rows to serialise.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models import Post, Tag
from app.models.post import PostStatus


def _register_owner(client) -> tuple[int, int]:
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
    user = resp.json()["user"]
    return user["blog_memberships"][0]["blog_id"], user["id"]


def _seed(blog_id: int, author_id: int, posts: list[tuple[bool, list[str]]]) -> None:
    """Create posts as (published, tag names) pairs, sharing Tag rows by name."""
    with Session(engine) as session:
        tags: dict[str, Tag] = {}
        for published, tag_names in posts:
            for name in tag_names:
                if name not in tags:
                    tags[name] = Tag(name=name, blog_id=blog_id)
                    session.add(tags[name])
            session.flush()

            post = Post(
                title=f"Post {uuid.uuid4().hex[:8]}",
                slug=f"post-{uuid.uuid4().hex[:8]}",
                content="Body content.",
                blog_id=blog_id,
                author_id=author_id,
                status=PostStatus.PUBLISHED if published else PostStatus.DRAFT,
                published=published,
            )
            post.tags = [tags[name] for name in tag_names]
            session.add(post)
        session.commit()


def test_popular_tags_returns_counts_for_published_posts(client):
    blog_id, author_id = _register_owner(client)
    _seed(
        blog_id,
        author_id,
        [
            (True, ["ai", "elections"]),
            (True, ["ai"]),
            (True, ["crash"]),
            (False, ["draft-only", "ai"]),
        ],
    )

    res = client.get(f"/blogs/{blog_id}/tags/popular?limit=6")

    assert res.status_code == 200, res.text
    body = res.json()
    # Highest count first, ties broken alphabetically; draft usage doesn't count.
    assert [(t["name"], t["count"]) for t in body] == [("ai", 2), ("crash", 1), ("elections", 1)]
    assert all(t["blog_id"] == blog_id for t in body)


def test_popular_tags_respects_limit(client):
    blog_id, author_id = _register_owner(client)
    _seed(blog_id, author_id, [(True, ["a", "b", "c"])])

    res = client.get(f"/blogs/{blog_id}/tags/popular?limit=2")

    assert res.status_code == 200, res.text
    assert len(res.json()) == 2


def test_popular_tags_empty_when_no_published_post_is_tagged(client):
    blog_id, author_id = _register_owner(client)
    _seed(blog_id, author_id, [(True, []), (False, ["draft-only"])])

    res = client.get(f"/blogs/{blog_id}/tags/popular")

    assert res.status_code == 200, res.text
    assert res.json() == []
