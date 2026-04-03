from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy import func, desc
from typing import List
from app.dbConfig import get_session
from app.models import Tag, User, Post, PostTagLink
from app.schemas.schemas import TagRead, TagUpdate, TagCreate, PopularTagRead
from app.utils.auth import admin_only

router = APIRouter(prefix="/tags", tags=["tags"])

@router.post("/", response_model=TagRead)
def create_tag(
    tag_data: TagCreate,  # ✅ CHANGED: Use Pydantic schema instead of string
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Create a new tag.
    Checks for duplicates (case-insensitive).
    """
    # Check if the tag already exists (case-insensitive)
    existing_tag = session.exec(
        select(Tag).where(Tag.name.ilike(tag_data.name))
    ).first()
    
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Tag '{tag_data.name}' already exists"
        )

    # Create new tag
    db_tag = Tag(name=tag_data.name)
    session.add(db_tag)
    session.commit()
    session.refresh(db_tag)
    return db_tag

@router.get("/", response_model=List[TagRead])
def read_tags(session: Session = Depends(get_session)):
    """Get all tags"""
    return session.exec(select(Tag)).all()

@router.get("/popular", response_model=List[PopularTagRead])
def read_popular_tags(limit: int = 4, session: Session = Depends(get_session)):
    """Get the most-used tags across published posts."""
    safe_limit = max(1, min(limit, 20))

    statement = (
        select(
            Tag.id,
            Tag.name,
            func.count(PostTagLink.post_id).label("count")
        )
        .join(PostTagLink, PostTagLink.tag_id == Tag.id)
        .join(Post, Post.id == PostTagLink.post_id)
        .where(Post.published == True)
        .group_by(Tag.id, Tag.name)
        .order_by(desc("count"), Tag.name.asc())
        .limit(safe_limit)
    )

    rows = session.exec(statement).all()
    return [
        PopularTagRead(id=row.id, name=row.name, count=row.count)
        for row in rows
    ]

@router.patch("/{tag_id}", response_model=TagRead)
def update_tag(
    tag_id: int, 
    tag_data: TagUpdate, 
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Rename an existing tag. 
    Restricted to admins to maintain site taxonomy.
    """
    # Fetch the existing tag
    db_tag = session.get(Tag, tag_id)
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if the new name is already taken (case-insensitive)
    if tag_data.name:
        existing_name = session.exec(
            select(Tag).where(
                Tag.name.ilike(tag_data.name), 
                Tag.id != tag_id
            )
        ).first()
        if existing_name:
            raise HTTPException(
                status_code=400, 
                detail=f"Tag name '{tag_data.name}' already exists"
            )
        
        db_tag.name = tag_data.name

    # Save and return
    session.add(db_tag)
    session.commit()
    session.refresh(db_tag)
    return db_tag

@router.delete("/{tag_id}", status_code=status.HTTP_200_OK)
def delete_tag(
    tag_id: int, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(admin_only)
):
    """
    Delete a tag from the system.
    SQLAlchemy automatically handles cleanup of post-tag relationships.
    """
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Tag not found"
        )
    
    session.delete(tag)
    session.commit()
    return {"ok": True, "message": f"Tag '{tag.name}' deleted successfully"}
