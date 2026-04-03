from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from typing import List
from app.dbConfig import get_session
from app.models import Comment, User, Post, UserRole
from app.schemas.schemas import CommentCreate, CommentRead
from app.utils.auth import get_current_user

router = APIRouter(prefix="/comments", tags=["Comments"])

@router.post("/", response_model=CommentRead)
def create_comment(
    comment_data: CommentCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Ensure parent_id 0 is treated as None
    if comment_data.parent_id == 0:
        comment_data.parent_id = None

    # Verify that the post exists
    post = session.get(Post, comment_data.post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post with ID {comment_data.post_id} not found")
    
    # Set the user_id to the current user's ID
    new_comment = Comment(**comment_data.model_dump())
    new_comment.user_id = current_user.id # Ensure the author is set correctly
    
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)
    
    # Explicitly load the replies relationship to avoid lazy loading issues
    statement = select(Comment).where(Comment.id == new_comment.id).options(selectinload(Comment.replies))
    new_comment = session.exec(statement).first()
        
    return new_comment

@router.get("/post/{post_id}", response_model=List[CommentRead])
def get_post_comments(post_id: int, session: Session = Depends(get_session)):
    """
    Get top-level comments for a post.
    Nested replies are automatically loaded up to the configured join_depth.
    """
    statement = select(Comment).where(
        Comment.post_id == post_id, 
        Comment.parent_id == None
    )
    return session.exec(statement).all()

@router.patch("/{comment_id}", response_model=CommentRead)
def update_comment(
    comment_id: int, 
    content: str, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Updates a comment's content. Only the author can perform this action.
    The 'updated_at' field is handled automatically by the database.
    """
    # 1. Fetch the comment and its user relationship for the response
    statement = select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.user))
    comment = session.exec(statement).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # 2. Authorization Check: Ensure the current user is the author
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to edit this comment")
    
    # 3. Apply updates
    comment.content = content
    
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment

@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    comment = session.get(Comment, comment_id)
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # --- UPDATED AUTHORIZATION LOGIC ---
    # Allow deletion if the user is the author OR if they are an admin
    is_author = comment.user_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN
    
    if not (is_author or is_admin):
        raise HTTPException(
            status_code=403, 
            detail="Moderator privileges or ownership required to delete this content"
        )

    # Perform Soft Delete (Redaction) to keep the thread structure intact
    if is_author:
        comment.content = "[This comment has been deleted by the author]"
    elif is_admin:
        comment.content = "[This comment has been deleted by a moderator]"
    comment.is_deleted = True

    session.add(comment)
    session.commit()
    return {"ok": True, "message": "Comment moderated successfully"}