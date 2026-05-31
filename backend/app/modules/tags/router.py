from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.permissions import get_public_blog, require_blog_editor, require_completed_onboarding
from app.core.security import get_current_user
from app.models import Post, PostTagLink, Tag, User, Blog
from app.schemas import PopularTagRead, TagCreate, TagRead, TagUpdate

router = APIRouter(prefix="/blogs/{blog_id}/tags", tags=["tags"])


@router.post("/", response_model=TagRead)
def create_tag(
    blog_id: int,
    tag_data: TagCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_editor),
    __: None = Depends(require_completed_onboarding),
):
    existing_tag = session.exec(select(Tag).where(Tag.name.ilike(tag_data.name), Tag.blog_id == blog_id)).first()
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag '{tag_data.name}' already exists",
        )

    db_tag = Tag(name=tag_data.name, blog_id=blog_id)
    session.add(db_tag)
    session.flush()
    add_audit_log(
        session,
        action="tag.create",
        resource_type="tag",
        resource_id=db_tag.id,
        blog_id=blog_id,
        actor=current_user,
        details={"name": db_tag.name},
    )
    session.commit()
    session.refresh(db_tag)
    return db_tag


@router.get("/", response_model=List[TagRead])
def read_tags(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog)
):
    return session.exec(select(Tag).where(Tag.blog_id == blog_id)).all()


@router.get("/popular", response_model=List[PopularTagRead])
def read_popular_tags(
    blog_id: int,
    limit: int = 4, 
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog)
):
    safe_limit = max(1, min(limit, 20))

    statement = (
        select(
            Tag.id,
            Tag.name,
            func.count(PostTagLink.post_id).label("count"),
        )
        .join(PostTagLink, PostTagLink.tag_id == Tag.id)
        .join(Post, Post.id == PostTagLink.post_id)
        .where(Post.published == True, Post.blog_id == blog_id, Tag.blog_id == blog_id)
        .group_by(Tag.id, Tag.name)
        .order_by(desc("count"), Tag.name.asc())
        .limit(safe_limit)
    )

    rows = session.exec(statement).all()
    return [PopularTagRead(id=row.id, name=row.name, count=row.count) for row in rows]


@router.patch("/{tag_id}", response_model=TagRead)
def update_tag(
    blog_id: int,
    tag_id: int,
    tag_data: TagUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_editor),
    __: None = Depends(require_completed_onboarding),
):
    db_tag = session.exec(select(Tag).where(Tag.id == tag_id, Tag.blog_id == blog_id)).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag_data.name:
        existing_name = session.exec(
            select(Tag).where(Tag.name.ilike(tag_data.name), Tag.id != tag_id, Tag.blog_id == blog_id)
        ).first()
        if existing_name:
            raise HTTPException(
                status_code=400,
                detail=f"Tag name '{tag_data.name}' already exists",
            )

        db_tag.name = tag_data.name

    session.add(db_tag)
    add_audit_log(
        session,
        action="tag.update",
        resource_type="tag",
        resource_id=db_tag.id,
        blog_id=blog_id,
        actor=current_user,
        details={"name": db_tag.name},
    )
    session.commit()
    session.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}", status_code=status.HTTP_200_OK)
def delete_tag(
    blog_id: int,
    tag_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_editor),
    __: None = Depends(require_completed_onboarding),
):
    tag = session.exec(select(Tag).where(Tag.id == tag_id, Tag.blog_id == blog_id)).first()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    add_audit_log(
        session,
        action="tag.delete",
        resource_type="tag",
        resource_id=tag.id,
        blog_id=blog_id,
        actor=current_user,
        details={"name": tag.name},
    )
    session.delete(tag)
    session.commit()
    return {"ok": True, "message": f"Tag '{tag.name}' deleted successfully"}
