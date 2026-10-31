"""
Each blog's sitemap.xml, rss.xml and robots.txt — served on the blog's own
address by its edge middleware, which passes the host it was asked for.

URLs are built on that host (not the blog's canonical address), so a blog
reached on its custom domain and on its subdomain each advertise the address
the crawler actually asked for.
"""
from datetime import datetime
from email.utils import format_datetime
from typing import Optional
from xml.sax.saxutils import escape

from sqlmodel import Session, select

from app.core.datetimes import as_utc, utc_now
from app.core.text import plain_excerpt
from app.models import Blog, OnboardingStatus, Post
from app.models.post import PostStatus
from app.modules.blogs.service import resolve_blog_by_host
from app.modules.settings.router import general_settings_for

RSS_ITEMS = 20
EXCERPT_LENGTH = 300
STATIC_PAGES = ("/", "/blog", "/about", "/contact")
# escape() handles &, < and >; inside an attribute a " must be escaped too.
ATTRIBUTE_QUOTES = {'"': "&quot;"}


def _origin(host: str) -> str:
    return f"https://{host.strip().lower()}"


def _public_posts(session: Session, blog_id: int, limit: Optional[int] = None) -> list[Post]:
    statement = (
        select(Post)
        .where(Post.blog_id == blog_id, Post.status == PostStatus.PUBLISHED, Post.is_sample == False)  # noqa: E712
        .order_by(Post.published_at.desc(), Post.id.desc())
    )
    if limit:
        statement = statement.limit(limit)
    return list(session.exec(statement).all())


def _listed(blog: Blog) -> bool:
    """Only finished blogs are offered to search engines."""
    return blog.onboarding_status == OnboardingStatus.COMPLETED


def _last_changed(post: Post) -> Optional[datetime]:
    moments = [as_utc(m) for m in (post.edited_at, post.published_at) if m]
    return max(moments) if moments else None


def sitemap(host: str, session: Session) -> str:
    blog = resolve_blog_by_host(host, session)
    origin = _origin(host)
    urls: list[tuple[str, Optional[datetime]]] = []
    if _listed(blog):
        posts = _public_posts(session, blog.id)
        newest = max((_last_changed(p) for p in posts if _last_changed(p)), default=None)
        urls += [(f"{origin}{path}", newest if path in ("/", "/blog") else None) for path in STATIC_PAGES]
        urls += [(f"{origin}/post/{post.slug}", _last_changed(post)) for post in posts]

    entries = "".join(
        f"<url><loc>{escape(loc)}</loc>"
        + (f"<lastmod>{changed.date().isoformat()}</lastmod>" if changed else "")
        + "</url>"
        for loc, changed in urls
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{entries}</urlset>\n'
    )


def rss(host: str, session: Session) -> str:
    blog = resolve_blog_by_host(host, session)
    origin = _origin(host)
    general = general_settings_for(session, blog)
    title = general.get("site_name") or blog.name
    description = general.get("site_tagline") or general.get("site_description") or blog.name
    posts = _public_posts(session, blog.id, RSS_ITEMS) if _listed(blog) else []

    items = []
    for post in posts:
        link = f"{origin}/post/{post.slug}"
        published = as_utc(post.published_at) or as_utc(post.created_at)
        image = (
            f'<media:content url="{escape(post.thumbnail_url, ATTRIBUTE_QUOTES)}" medium="image" />'
            if post.thumbnail_url else ""
        )
        items.append(
            "<item>"
            f"<title>{escape(post.title)}</title>"
            f"<link>{escape(link)}</link>"
            f'<guid isPermaLink="true">{escape(link)}</guid>'
            f"<pubDate>{format_datetime(published)}</pubDate>"
            f"<description>{escape(plain_excerpt(post.content, EXCERPT_LENGTH))}</description>"
            f"{image}"
            "</item>"
        )

    built = format_datetime(as_utc(posts[0].published_at) if posts and posts[0].published_at else utc_now())
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">'
        "<channel>"
        f"<title>{escape(title)}</title>"
        f"<link>{escape(origin)}/</link>"
        f"<description>{escape(description)}</description>"
        f"<language>{escape(general.get('language') or 'en')}</language>"
        f"<lastBuildDate>{built}</lastBuildDate>"
        f'<atom:link href="{escape(origin)}/rss.xml" rel="self" type="application/rss+xml" />'
        f"{''.join(items)}"
        "</channel></rss>\n"
    )


def robots(host: str, session: Session) -> str:
    blog = resolve_blog_by_host(host, session)
    origin = _origin(host)
    if not _listed(blog):
        return "User-agent: *\nDisallow: /\n"
    # The sign-in and search pages aren't content worth indexing.
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /auth\n"
        "Disallow: /search\n"
        f"\nSitemap: {origin}/sitemap.xml\n"
    )
