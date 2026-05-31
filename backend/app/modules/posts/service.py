import os
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
from app.schemas import PostCreate, PostUpdate
from app.core.permissions import Permissions

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


def upload_post_image(file: UploadFile) -> dict[str, str]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    result = cloudinary.uploader.upload(file.file, folder="blog_images")
    return {"url": result.get("secure_url")}


def create_post(blog_id: int, post_data: PostCreate, session: Session, current_user: User) -> Post:
    if not Permissions.can_create_post(current_user, blog_id, session):
        raise HTTPException(status_code=403, detail="Not authorized to create posts in this blog")

    new_post = Post(**post_data.model_dump(exclude={"tag_ids", "slug"}))
    new_post.author_id = current_user.id
    new_post.blog_id = blog_id

    source_for_slug = post_data.slug if post_data.slug else post_data.title
    new_post.slug = Post.generate_unique_slug(source_for_slug, blog_id, session)
    new_post.tags = _get_tags_by_ids(session, blog_id, post_data.tag_ids)

    session.add(new_post)
    session.flush()
    add_audit_log(
        session,
        action="post.create",
        resource_type="post",
        resource_id=new_post.id,
        blog_id=blog_id,
        actor=current_user,
        details={"published": new_post.published},
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
    query = select(Post).where(Post.blog_id == blog_id).options(
        selectinload(Post.tags),
        selectinload(Post.author),
    )

    can_view_drafts = False
    if current_user:
        role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
        if role in [BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]:
            can_view_drafts = True

    if not can_view_drafts:
        query = query.where(Post.published == True)

    if filter_value and filter_value.lower() == "projects":
        query = query.where(Post.is_project == True)

    return session.exec(query).all()


def search_posts(
    blog_id: int,
    session: Session,
    q: Optional[str] = None,
    tag: Optional[str] = None,
) -> List[Post]:
    statement = select(Post).where(Post.blog_id == blog_id, Post.published == True)

    if q:
        statement = statement.where(
            or_(
                Post.title.contains(q),
                Post.content.contains(q),
            )
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
    update_dict = post_data.model_dump(exclude_unset=True, exclude={"tag_ids"})

    if "slug" in update_dict and update_dict["slug"] != db_post.slug:
        update_dict["slug"] = Post.generate_unique_slug(update_dict["slug"], blog_id, session)

    for key, value in update_dict.items():
        setattr(db_post, key, value)

    if post_data.tag_ids is not None:
        db_post.tags = _get_tags_by_ids(session, blog_id, post_data.tag_ids)

    session.add(db_post)
    add_audit_log(
        session,
        action="post.update",
        resource_type="post",
        resource_id=db_post.id,
        blog_id=blog_id,
        actor=current_user,
        details={"fields": sorted(update_dict.keys())},
    )
    session.commit()
    session.refresh(db_post)
    return db_post


def delete_post(blog_id: int, post_id: int, session: Session, current_user: User) -> dict[str, object]:
    post = _get_post_or_404(session, blog_id, post_id)
    if not Permissions.can_edit_post(current_user, post, session):
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    add_audit_log(
        session,
        action="post.delete",
        resource_type="post",
        resource_id=post.id,
        blog_id=blog_id,
        actor=current_user,
        details={"title": post.title},
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
    blog_id: int,
    slug: str,
    session: Session,
    current_user: Optional[User],
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

    if post.views is None:
        post.views = 0

    post.views += 1
    session.add(post)
    session.commit()
    session.refresh(post)

    can_view_drafts = False
    if current_user:
        role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
        if role in [BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]:
            can_view_drafts = True

    if not post.published and not can_view_drafts:
        raise HTTPException(status_code=403, detail="Not authorized to view drafts")

    return post


def _get_post_or_404(session: Session, blog_id: int, post_id: int) -> Post:
    post = session.exec(select(Post).where(Post.id == post_id, Post.blog_id == blog_id)).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def _get_tags_by_ids(session: Session, blog_id: int, tag_ids: Optional[List[int]]) -> List[Tag]:
    if not tag_ids:
        return []

    statement = select(Tag).where(Tag.id.in_(tag_ids), Tag.blog_id == blog_id)
    return session.exec(statement).all()
