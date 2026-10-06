"""
Coverage for GET /blogs/meta — the read-only <head> metadata the public
blog's edge middleware server-renders for link previews and crawlers.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models import Post
from app.models.post import PostStatus


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[int, int, str]:
    """Returns (blog_id, user_id, host)."""
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
    membership = body["user"]["blog_memberships"][0]
    return membership["blog_id"], body["user"]["id"], f"{membership['blog']['subdomain']}.inko.blog"


def _create_post(blog_id: int, author_id: int, status: PostStatus, content: str = "Body content.") -> tuple[int, str]:
    with Session(engine) as session:
        post = Post(
            title="Hello <World> & \"friends\"",
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content=content,
            blog_id=blog_id,
            author_id=author_id,
            thumbnail_url="https://example.com/cover.png",
            status=status,
            published=status == PostStatus.PUBLISHED,
            views=7,
        )
        session.add(post)
        session.commit()
        session.refresh(post)
        return post.id, post.slug


def test_meta_for_a_non_post_path_returns_site_fields_only(client):
    _, _, host = _register_owner(client)
    res = client.get("/blogs/meta", params={"host": host, "path": "/about"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["site_name"]
    assert body["language"]
    assert body["post"] is None


def test_meta_for_a_published_post_includes_post_fields(client):
    blog_id, user_id, host = _register_owner(client)
    _, slug = _create_post(
        blog_id, user_id, PostStatus.PUBLISHED, content="# Heading\n\nSome **bold** text with a [link](https://x.y)."
    )

    res = client.get("/blogs/meta", params={"host": host, "path": f"/post/{slug}"})
    assert res.status_code == 200, res.text
    post = res.json()["post"]
    assert post["slug"] == slug
    assert post["title"] == "Hello <World> & \"friends\""
    assert post["description"] == "Heading Some bold text with a link."
    assert post["image"] == "https://example.com/cover.png"
    assert post["author_name"] == "Ada Lovelace"
    assert post["published_at"].endswith(("Z", "+00:00"))


def test_meta_does_not_expose_draft_posts(client):
    blog_id, user_id, host = _register_owner(client)
    _, slug = _create_post(blog_id, user_id, PostStatus.DRAFT)

    res = client.get("/blogs/meta", params={"host": host, "path": f"/post/{slug}"})
    assert res.status_code == 200, res.text
    assert res.json()["post"] is None


def test_meta_does_not_increment_views(client):
    blog_id, user_id, host = _register_owner(client)
    post_id, slug = _create_post(blog_id, user_id, PostStatus.PUBLISHED)

    for _ in range(3):
        assert client.get("/blogs/meta", params={"host": host, "path": f"/post/{slug}"}).status_code == 200

    with Session(engine) as session:
        assert session.get(Post, post_id).views == 7


def test_meta_for_an_unknown_host_is_404(client):
    res = client.get("/blogs/meta", params={"host": f"nope-{uuid.uuid4().hex[:8]}.inko.blog", "path": "/"})
    assert res.status_code == 404


def test_meta_truncates_long_descriptions(client):
    blog_id, user_id, host = _register_owner(client)
    _, slug = _create_post(blog_id, user_id, PostStatus.PUBLISHED, content="word " * 200)

    res = client.get("/blogs/meta", params={"host": host, "path": f"/post/{slug}"})
    description = res.json()["post"]["description"]
    assert len(description) <= 161
    assert description.endswith("…")


def test_meta_never_falls_back_to_platform_branding(client):
    """A tenant with no saved general/contact settings shows its own name — never the platform's."""
    from sqlmodel import select

    from app.models import Blog, SiteSettings

    blog_id, _, host = _register_owner(client)
    with Session(engine) as session:
        for row in session.exec(select(SiteSettings).where(SiteSettings.blog_id == blog_id)).all():
            if row.setting_key in ("general", "contact"):
                session.delete(row)
        session.commit()
        blog_name = session.get(Blog, blog_id).name

    meta = client.get("/blogs/meta", params={"host": host, "path": "/"}).json()
    assert meta["site_name"] == blog_name
    assert meta["site_tagline"] != "Your ideas, amplified"

    public = client.get(f"/blogs/{blog_id}/settings/public").json()
    assert public["general"]["site_name"] == blog_name
    assert public["contact"]["contact_email"] is None
    assert "inko" not in str(public["general"]).lower()
