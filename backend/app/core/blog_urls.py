"""Where a blog lives publicly — mirrors the studio's shared/lib/blogUrl.ts."""
from app.core.config import settings
from app.models import Blog


def blog_public_url(blog: Blog) -> str:
    """Its own domain when it has one, its {subdomain}.{PUBLIC_BLOG_BASE_DOMAIN} address otherwise."""
    if blog.custom_domain:
        return f"https://{blog.custom_domain}"
    return f"https://{blog.subdomain}.{settings.PUBLIC_BLOG_BASE_DOMAIN}"


def post_public_url(blog: Blog, slug: str) -> str:
    """A post on the public blog — matches the blog's /post/:slug route."""
    return f"{blog_public_url(blog)}/post/{slug}"
