import os
import secrets
from pathlib import Path
from jinja2 import Template
from datetime import datetime, timezone
from typing import List, Optional

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.models import Comment, Post, Tag, User, BlogRole
from app.models.post import PostStatus
from app.schemas import PostCreate, PostUpdate
from app.core.permissions import Permissions

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


# START

def _generate_welcome_banner_svg(blog_name: str) -> str:
    """Generate a clean, minimal SVG banner."""
    escaped_name = blog_name.replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
    
    return f"""<?xml version="1.0" encoding="UTF-8"?>
    <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#6B21A8"/>
            <stop offset="100%" stop-color="#A855F7"/>
            </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="1200" height="630" fill="url(#grad)"/>
        
        <!-- Very subtle overlay pattern -->
        <rect width="1200" height="630" fill="rgba(255,255,255,0.06)"/>
        
        <!-- Main Title -->
        <text x="600" y="290" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="82" font-weight="700" letter-spacing="-3px">
            Welcome
        </text>
        
        <text x="600" y="380" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="68" font-weight="600" letter-spacing="-2px" opacity="0.95">
            to {escaped_name}
        </text>
        
        <!-- Thin elegant divider -->
        <rect x="360" y="430" width="480" height="3" rx="1.5" fill="rgba(255,255,255,0.65)"/>
    </svg>"""

def upload_welcome_banner(blog_name: str) -> str:
    """Generate SVG and upload to Cloudinary. Returns secure URL."""
    svg_content = _generate_welcome_banner_svg(blog_name)
    
    try:
        result = cloudinary.uploader.upload(
            svg_content,
            folder="welcome_banners",
            resource_type="image",
            public_id=f"welcome-{secrets.token_hex(8)}",
            overwrite=True
        )
        url = result.get("secure_url")
        print(f"✅ Welcome banner uploaded: {url}")
        return url
    except Exception as e:
        print(f"⚠️ Failed to upload welcome banner: {e}")
        return "https://picsum.photos/id/870/1200/630"  # fallback

# END


# ── Scheduling helpers ────────────────────────────────────────────────────────

def _resolve_status(
    status: Optional[PostStatus],
    published: Optional[bool],
    published_at: Optional[datetime],
) -> tuple[PostStatus, bool, Optional[datetime]]:
    """
    Resolve the final (status, published, published_at) triple from request data.

    Rules:
    - If status=scheduled and published_at is in the past → promote to published
    - If status=scheduled and no published_at → raise 400
    - If status=published and no published_at → set published_at = now()
    - If status=draft → clear published_at, published=False
    - Backward compat: if only `published` bool is set, derive status from it
    """
    now = datetime.now(timezone.utc)

    # Backward compat — old clients only send `published: bool`
    if status is None:
        if published is True:
            status = PostStatus.PUBLISHED
        else:
            status = PostStatus.DRAFT

    if status == PostStatus.SCHEDULED:
        if not published_at:
            raise HTTPException(
                status_code=400,
                detail="published_at is required when status is 'scheduled'",
            )
        # Normalise to UTC-aware
        if published_at.tzinfo is None:
            published_at = published_at.replace(tzinfo=timezone.utc)
        # If scheduled time is already past, publish immediately
        if published_at <= now:
            return PostStatus.PUBLISHED, True, published_at
        return PostStatus.SCHEDULED, False, published_at

    if status == PostStatus.PUBLISHED:
        if not published_at:
            published_at = now
        if published_at.tzinfo is None:
            published_at = published_at.replace(tzinfo=timezone.utc)
        return PostStatus.PUBLISHED, True, published_at

    # DRAFT
    return PostStatus.DRAFT, False, None


# ── Image upload ──────────────────────────────────────────────────────────────

def upload_post_image(file: UploadFile) -> dict[str, str]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type")
    result = cloudinary.uploader.upload(file.file, folder="blog_images")
    return {"url": result.get("secure_url")}


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_post(blog_id: int, post_data: PostCreate, session: Session, current_user: User) -> Post:
    if not Permissions.can_create_post(current_user, blog_id, session):
        raise HTTPException(status_code=403, detail="Not authorized to create posts in this blog")

    resolved_status, resolved_published, resolved_published_at = _resolve_status(
        post_data.status, post_data.published, post_data.published_at
    )

    new_post = Post(
        **post_data.model_dump(
            exclude={"tag_ids", "slug", "status", "published", "published_at"}
        )
    )
    new_post.author_id    = current_user.id
    new_post.blog_id      = blog_id
    new_post.status       = resolved_status
    new_post.published    = resolved_published
    new_post.published_at = resolved_published_at

    source_for_slug = post_data.slug if post_data.slug else post_data.title
    new_post.slug   = Post.generate_unique_slug(source_for_slug, blog_id, session)
    new_post.tags   = _get_tags_by_ids(session, blog_id, post_data.tag_ids)

    session.add(new_post)
    session.flush()

    add_audit_log(
        session,
        action=f"post.{resolved_status.value}",
        resource_type="post",
        resource_id=new_post.id,
        blog_id=blog_id,
        actor=current_user,
        details={
            "title": new_post.title,
            "status": resolved_status.value,
            "published_at": resolved_published_at.isoformat() if resolved_published_at else None,
        },
    )

    session.commit()
    session.refresh(new_post)
    return new_post


def read_posts(
    blog_id: int,
    session: Session,
    current_user: Optional[User],
    filter_value: Optional[str] = None,
) -> List[Post]:
    query = (
        select(Post)
        .where(Post.blog_id == blog_id)
        .options(selectinload(Post.tags), selectinload(Post.author))
    )

    can_view_drafts = False
    if current_user:
        role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
        if role in [BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]:
            can_view_drafts = True

    # Public visitors only see published posts
    if not can_view_drafts:
        query = query.where(Post.status == PostStatus.PUBLISHED)

    if filter_value and filter_value.lower() == "projects":
        query = query.where(Post.is_project == True)

    return session.exec(query).all()


def get_scheduled_posts(blog_id: int, session: Session, current_user: User) -> List[Post]:
    """Return all scheduled (not yet live) posts for this blog."""
    if not Permissions.can_create_post(current_user, blog_id, session):
        raise HTTPException(status_code=403, detail="Not authorized")
    return session.exec(
        select(Post)
        .where(Post.blog_id == blog_id, Post.status == PostStatus.SCHEDULED)
        .order_by(Post.published_at.asc())
        .options(selectinload(Post.tags), selectinload(Post.author))
    ).all()


def search_posts(
    blog_id: int,
    session: Session,
    q: Optional[str] = None,
    tag: Optional[str] = None,
) -> List[Post]:
    statement = select(Post).where(
        Post.blog_id == blog_id,
        Post.status == PostStatus.PUBLISHED,
    )
    if q:
        statement = statement.where(
            or_(Post.title.contains(q), Post.content.contains(q))
        )
    if tag:
        statement = statement.join(Post.tags).where(Tag.name == tag, Tag.blog_id == blog_id)
    statement = statement.options(selectinload(Post.author))
    return session.exec(statement).all()


def update_post(
    blog_id: int,
    post_id: int,
    post_data: PostUpdate,
    session: Session,
    current_user: User,
) -> Post:
    db_post = _get_post_or_404(session, blog_id, post_id)
    if not Permissions.can_edit_post(current_user, db_post, session):
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")

    update_dict = post_data.model_dump(
        exclude_unset=True,
        exclude={"tag_ids", "status", "published", "published_at"},
    )

    # Slug uniqueness
    if "slug" in update_dict and update_dict["slug"] != db_post.slug:
        update_dict["slug"] = Post.generate_unique_slug(update_dict["slug"], blog_id, session)

    # Apply scalar fields
    for key, value in update_dict.items():
        setattr(db_post, key, value)

    # Resolve status change if any scheduling field was touched
    if any(f in post_data.model_fields_set for f in ("status", "published", "published_at")):
        resolved_status, resolved_published, resolved_published_at = _resolve_status(
            post_data.status, post_data.published, post_data.published_at
        )
        db_post.status       = resolved_status
        db_post.published    = resolved_published
        db_post.published_at = resolved_published_at

    if post_data.tag_ids is not None:
        db_post.tags = _get_tags_by_ids(session, blog_id, post_data.tag_ids)

    session.add(db_post)
    add_audit_log(
        session,
        action="post.updated",
        resource_type="post",
        resource_id=db_post.id,
        blog_id=blog_id,
        actor=current_user,
        details={
            "fields": sorted(post_data.model_fields_set),
            "status": db_post.status.value,
        },
    )
    session.commit()
    session.refresh(db_post)
    return db_post


def delete_post(blog_id: int, post_id: int, session: Session, current_user: User) -> dict:
    post = _get_post_or_404(session, blog_id, post_id)
    if not Permissions.can_edit_post(current_user, post, session):
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    add_audit_log(
        session,
        action="post.deleted",
        resource_type="post",
        resource_id=post.id,
        blog_id=blog_id,
        actor=current_user,
        details={"title": post.title, "status": post.status.value},
    )
    session.delete(post)
    session.commit()
    return {"ok": True, "message": "Post deleted successfully"}


def read_post(blog_id: int, post_id: int, session: Session) -> Post:
    statement = (
        select(Post)
        .where(Post.id == post_id, Post.blog_id == blog_id)
        .options(
            selectinload(Post.author),
            selectinload(Post.tags),
            selectinload(Post.project_metadata),
            selectinload(Post.comments).selectinload(Comment.user),
            selectinload(Post.comments).selectinload(Comment.replies).selectinload(Comment.user),
        )
    )
    post = session.exec(statement).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def read_post_by_slug(
    blog_id: int, slug: str, session: Session, current_user: Optional[User]
) -> Post:
    statement = (
        select(Post)
        .where(Post.slug == slug, Post.blog_id == blog_id)
        .options(
            selectinload(Post.author),
            selectinload(Post.tags),
            selectinload(Post.comments).selectinload(Comment.user),
        )
    )
    post = session.exec(statement).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Increment views only for published posts
    if post.status == PostStatus.PUBLISHED:
        post.views = (post.views or 0) + 1
        session.add(post)
        session.commit()
        session.refresh(post)

    # Draft/scheduled visibility check
    can_view = False
    if current_user:
        role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
        can_view = role in [BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]

    if post.status != PostStatus.PUBLISHED and not can_view:
        raise HTTPException(status_code=403, detail="Not authorized to view this post")

    return post


# ── Private helpers ───────────────────────────────────────────────────────────

def _get_post_or_404(session: Session, blog_id: int, post_id: int) -> Post:
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.blog_id == blog_id)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def _get_tags_by_ids(session: Session, blog_id: int, tag_ids: Optional[List[int]]) -> List[Tag]:
    if not tag_ids:
        return []
    return session.exec(
        select(Tag).where(Tag.id.in_(tag_ids), Tag.blog_id == blog_id)
    ).all()