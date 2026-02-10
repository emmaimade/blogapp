from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, Session, select
from typing import List
from app.dbConfig import get_session
from app.utils.auth import admin_only, get_current_user
from app.models import User, Post, Comment, UserRole
from app.schemas.schemas import CommentAdminRead, UserRead

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/stats", tags=["Admin"])
def get_system_stats(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Returns total counts for the Admin Dashboard.
    """
    total_users = session.exec(select(func.count(User.id))).one()
    total_posts = session.exec(select(func.count(Post.id))).one()
    total_comments = session.exec(select(func.count(Comment.id))).one()
    
    return {
        "users": total_users,
        "posts": total_posts,
        "comments": total_comments,
        "server_status": "online"
    }

@router.get("/users", response_model=List[UserRead])
def get_all_users(
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_user)
):
    if current_admin.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    return session.exec(select(User)).all()

@router.get("/comments", response_model=List[CommentAdminRead])
def get_all_comments_for_moderation(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Returns all comments for moderation.
    """
    statement = select(Comment).order_by(Comment.created_at.desc())
    return session.exec(statement).all()

@router.patch("/{user_id}/role")
def update_user_role(
    user_id: int,
    role_update: dict, # Expecting {"role": "admin"} or {"role": "user"}
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_user)
):
    # 1. Verify the person making the request is an Admin
    if current_admin.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # 2. Prevent self-demotion (Safety Standard)
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=400, 
            detail="You cannot change your own administrative role."
        )

    # 3. Fetch the target user
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 4. Update the role
    new_role_str = role_update.get("role")
    if new_role_str not in [role.value for role in UserRole]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    target_user.role = UserRole(new_role_str)
    
    session.add(target_user)
    session.commit()
    
    return {"message": f"User {target_user.username} is now a {new_role_str}"}