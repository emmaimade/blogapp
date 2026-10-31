"""
Each blog's sitemap.xml, rss.xml and robots.txt: what's listed (published,
non-sample posts on a finished blog, on the host that was asked for), valid
XML with markup in titles escaped, and nothing offered for unfinished,
suspended or unknown blogs.
"""

import uuid
import xml.etree.ElementTree as ET
from datetime import timedelta

from sqlmodel import Session

from app.core.datetimes import utc_now
from app.core.db import engine
from app.models import Blog, OnboardingStatus, Post
from app.models.post import PostStatus

SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def _blog(client, *, finished: bool = True) -> tuple[int, int, str]:
    resp = client.post("/users/register", json={
        "first_name": "Ada", "last_name": "Lovelace",
        "email": f"user-{uuid.uuid4().hex[:12]}@example.com", "password": "correcthorse1",
        "workspace_name": f"Blog {uuid.uuid4().hex[:6]}",
    })
    assert resp.status_code == 200, resp.text
    client.cookies.clear()
    body = resp.json()
    blog_id = body["user"]["blog_memberships"][0]["blog_id"]
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        if finished:
            blog.onboarding_status = OnboardingStatus.COMPLETED
            session.add(blog)
            session.commit()
        host = f"{blog.subdomain}.inko.blog"
    return blog_id, body["user"]["id"], host


def _post(blog_id: int, user_id: int, title: str, status=PostStatus.PUBLISHED, sample=False, days_ago=1) -> str:
    slug = f"p-{uuid.uuid4().hex[:8]}"
    with Session(engine) as session:
        session.add(Post(title=title, slug=slug, content="Some **body** text.", blog_id=blog_id, author_id=user_id,
                         status=status, published=status == PostStatus.PUBLISHED, is_sample=sample,
                         published_at=utc_now() - timedelta(days=days_ago), thumbnail_url="https://img.example/a.jpg?x=1&y=2"))
        session.commit()
    return slug


def test_the_sitemap_lists_pages_and_published_posts_on_the_asked_host(client):
    blog_id, user_id, host = _blog(client)
    live = _post(blog_id, user_id, "Live")
    draft = _post(blog_id, user_id, "Draft", status=PostStatus.DRAFT)
    sample = _post(blog_id, user_id, "Sample", sample=True)

    res = client.get("/feeds/sitemap.xml", params={"host": host})

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/xml")
    locs = [el.text for el in ET.fromstring(res.text).iter(f"{SITEMAP_NS}loc")]
    assert f"https://{host}/" in locs and f"https://{host}/about" in locs
    assert f"https://{host}/post/{live}" in locs
    assert not any(draft in loc or sample in loc for loc in locs)


def test_the_rss_feed_is_valid_newest_first_and_escapes_titles(client):
    blog_id, user_id, host = _blog(client)
    _post(blog_id, user_id, "Older", days_ago=5)
    _post(blog_id, user_id, "Fish & <chips>", days_ago=1)

    res = client.get("/feeds/rss.xml", params={"host": host})

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/rss+xml")
    channel = ET.fromstring(res.text).find("channel")
    items = channel.findall("item")
    assert [i.findtext("title") for i in items] == ["Fish & <chips>", "Older"]
    assert items[0].findtext("description") == "Some body text."
    assert items[0].findtext("link").startswith(f"https://{host}/post/")


def test_robots_points_to_the_sitemap(client):
    _, _, host = _blog(client)

    res = client.get("/feeds/robots.txt", params={"host": host})

    assert res.status_code == 200
    assert f"Sitemap: https://{host}/sitemap.xml" in res.text
    assert "Disallow: /auth" in res.text


def test_an_unfinished_blog_offers_nothing_to_crawlers(client):
    blog_id, user_id, host = _blog(client, finished=False)
    _post(blog_id, user_id, "Early")

    assert "Disallow: /\n" in client.get("/feeds/robots.txt", params={"host": host}).text
    assert "<url>" not in client.get("/feeds/sitemap.xml", params={"host": host}).text
    assert ET.fromstring(client.get("/feeds/rss.xml", params={"host": host}).text).find("channel").findall("item") == []


def test_suspended_and_unknown_blogs_are_not_found(client):
    blog_id, _, host = _blog(client)
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.is_active = False
        session.add(blog)
        session.commit()

    assert client.get("/feeds/sitemap.xml", params={"host": host}).status_code == 404
    assert client.get("/feeds/rss.xml", params={"host": "nope.inko.blog"}).status_code == 404
