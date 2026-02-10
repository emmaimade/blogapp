from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from app.dbConfig import get_session
from app.models import Tag, User
from app.schemas.schemas import TagRead, TagUpdate
from app.utils.auth import admin_only

router = APIRouter(prefix="/tags", tags=["tags"])

@router.post("/", response_model=TagRead)
def create_tag(
    tag_name: str, 
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    # Check if the tag already exists (optional but recommended)
    existing_tag = session.exec(select(Tag).where(Tag.name == tag_name)).first()
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Tag already exists"
        )

    db_tag = Tag(name=tag_name)
    session.add(db_tag)
    session.commit()
    session.refresh(db_tag)
    return db_tag

@router.get("/", response_model=List[TagRead])
def read_tags(session: Session = Depends(get_session)):
    return session.exec(select(Tag)).all()

# tags.py

@router.patch("/{tag_id}", response_model=TagRead)
def update_tag(
    tag_id: int, 
    tag_data: TagUpdate, 
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Renames an existing tag. 
    Restricted to admins to maintain site taxonomy.
    """
    # 1. Fetch the existing tag
    db_tag = session.get(Tag, tag_id)
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # 2. Check if the new name is already taken by another tag
    if tag_data.name:
        existing_name = session.exec(
            select(Tag).where(Tag.name == tag_data.name, Tag.id != tag_id)
        ).first()
        if existing_name:
            raise HTTPException(status_code=400, detail="Tag name already exists")
        
        db_tag.name = tag_data.name

    # 3. Save and return
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
    Standard Tag Deletion: Removes the tag from the system.
    SQLModel/SQLAlchemy handles the cleanup of PostTagLink automatically.
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