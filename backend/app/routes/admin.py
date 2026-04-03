from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from sqlalchemy import desc
from typing import List, Dict, Any
from datetime import datetime, timedelta
from app.dbConfig import get_session
from app.models import Post, User, Comment, Tag
from app.schemas.schemas import CommentAdminRead
from app.utils.auth import admin_only

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/stats")
def get_admin_stats(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Get basic admin statistics.
    Industry standard: WordPress/Ghost dashboard shows real counts.
    """
    posts_count = session.exec(select(func.count(Post.id))).one()
    users_count = session.exec(select(func.count(User.id))).one()
    comments_count = session.exec(select(func.count(Comment.id))).one()
    tags_count = session.exec(select(func.count(Tag.id))).one()
    
    return {
        "posts": posts_count,
        "users": users_count,
        "comments": comments_count,
        "tags": tags_count
    }

@router.get("/stats/views")
def get_total_views(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Get total views across all posts.
    Returns actual view count from database.
    """
    # Sum all post views
    total_views = session.exec(
        select(func.sum(Post.views))
    ).one() or 0
    
    # Calculate weekly growth (posts created in last 7 days)
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    recent_posts = session.exec(
        select(func.count(Post.id))
        .where(Post.created_at >= one_week_ago)
    ).one() or 0
    
    # Calculate percentage growth (simple formula)
    total_posts = session.exec(select(func.count(Post.id))).one() or 1
    growth_percentage = round((recent_posts / total_posts) * 100) if total_posts > 0 else 0
    
    return {
        "total": int(total_views),
        "growth": f"+{growth_percentage}%",
        "trend": "up" if growth_percentage > 0 else "neutral"
    }

@router.get("/stats/activity")
def get_recent_activity(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only),
    limit: int = 10
):
    """
    Get recent activity feed (posts, comments, users).
    Industry standard: Real-time feed like WordPress.
    """
    activities: List[Dict[str, Any]] = []
    
    # Recent posts (last 10)
    recent_posts = session.exec(
        select(Post)
        .order_by(desc(Post.created_at))
        .limit(5)
    ).all()
    
    for post in recent_posts:
        activities.append({
            "type": "post",
            "title": "New post published" if post.published else "Draft created",
            "description": post.title,
            "time": post.created_at.isoformat(),
            "icon": "file"
        })
    
    # Recent comments (last 5)
    recent_comments = session.exec(
        select(Comment)
        .where(Comment.is_deleted == False)
        .order_by(desc(Comment.created_at))
        .limit(3)
    ).all()
    
    for comment in recent_comments:
        # Get post title
        post = session.get(Post, comment.post_id)
        user = session.get(User, comment.user_id)
        
        activities.append({
            "type": "comment",
            "title": "New comment",
            "description": f"{user.username if user else 'User'} commented on '{post.title if post else 'Post'}'",
            "time": comment.created_at.isoformat(),
            "icon": "message"
        })
    
    # Recent users (last 2)
    recent_users = session.exec(
        select(User)
        .order_by(desc(User.created_at))
        .limit(2)
    ).all()
    
    for user in recent_users:
        activities.append({
            "type": "user",
            "title": "New user registered",
            "description": f"{user.email} joined",
            "time": user.created_at.isoformat(),
            "icon": "user"
        })
    
    # Sort by time (most recent first)
    activities.sort(key=lambda x: x["time"], reverse=True)
    
    return activities[:limit]

@router.get("/stats/weekly")
def get_weekly_stats(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Get this week's statistics.
    Industry standard: Show actual week-over-week growth.
    """
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    # Posts this week
    posts_this_week = session.exec(
        select(func.count(Post.id))
        .where(Post.created_at >= one_week_ago)
    ).one() or 0
    
    # Posts last week
    posts_last_week = session.exec(
        select(func.count(Post.id))
        .where(Post.created_at >= two_weeks_ago, Post.created_at < one_week_ago)
    ).one() or 0
    
    posts_change = posts_this_week - posts_last_week
    
    # Comments this week
    comments_this_week = session.exec(
        select(func.count(Comment.id))
        .where(Comment.created_at >= one_week_ago, Comment.is_deleted == False)
    ).one() or 0
    
    comments_last_week = session.exec(
        select(func.count(Comment.id))
        .where(Comment.created_at >= two_weeks_ago, Comment.created_at < one_week_ago, Comment.is_deleted == False)
    ).one() or 0
    
    comments_change = comments_this_week - comments_last_week
    
    # Views this week (sum of views from posts created this week)
    views_this_week = session.exec(
        select(func.sum(Post.views))
        .where(Post.created_at >= one_week_ago)
    ).one() or 0
    
    # Total views for percentage calculation
    total_views = session.exec(select(func.sum(Post.views))).one() or 1
    views_percentage = round((int(views_this_week) / total_views) * 100) if total_views > 0 else 0
    
    return {
        "posts": {
            "count": posts_this_week,
            "change": f"+{posts_change}" if posts_change >= 0 else str(posts_change),
            "positive": posts_change >= 0
        },
        "comments": {
            "count": comments_this_week,
            "change": f"+{comments_change}" if comments_change >= 0 else str(comments_change),
            "positive": comments_change >= 0
        },
        "views": {
            "count": int(views_this_week),
            "change": f"+{views_percentage}%",
            "positive": views_percentage >= 0
        }
    }

@router.get("/stats/trends")
def get_trends(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """
    Get growth trends for stat cards.
    Industry standard: Show month-over-month growth.
    """
    now = datetime.utcnow()
    one_month_ago = now - timedelta(days=30)
    two_months_ago = now - timedelta(days=60)
    
    # Posts trend
    posts_this_month = session.exec(
        select(func.count(Post.id))
        .where(Post.created_at >= one_month_ago)
    ).one() or 0
    
    posts_last_month = session.exec(
        select(func.count(Post.id))
        .where(Post.created_at >= two_months_ago, Post.created_at < one_month_ago)
    ).one() or 0
    
    posts_growth = round(((posts_this_month - posts_last_month) / posts_last_month * 100)) if posts_last_month > 0 else 0
    
    # Users trend
    users_this_month = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= one_month_ago)
    ).one() or 0
    
    users_last_month = session.exec(
        select(func.count(User.id))
        .where(User.created_at >= two_months_ago, User.created_at < one_month_ago)
    ).one() or 0
    
    users_growth = round(((users_this_month - users_last_month) / users_last_month * 100)) if users_last_month > 0 else 0
    
    # Comments trend
    comments_this_month = session.exec(
        select(func.count(Comment.id))
        .where(Comment.created_at >= one_month_ago, Comment.is_deleted == False)
    ).one() or 0
    
    comments_last_month = session.exec(
        select(func.count(Comment.id))
        .where(Comment.created_at >= two_months_ago, Comment.created_at < one_month_ago, Comment.is_deleted == False)
    ).one() or 0
    
    comments_growth = round(((comments_this_month - comments_last_month) / comments_last_month * 100)) if comments_last_month > 0 else 0
    
    return {
        "posts": {
            "change": f"+{posts_growth}%" if posts_growth >= 0 else f"{posts_growth}%",
            "trend": "up" if posts_growth >= 0 else "down"
        },
        "users": {
            "change": f"+{users_growth}%" if users_growth >= 0 else f"{users_growth}%",
            "trend": "up" if users_growth >= 0 else "down"
        },
        "comments": {
            "change": f"+{comments_growth}%" if comments_growth >= 0 else f"{comments_growth}%",
            "trend": "up" if comments_growth >= 0 else "down"
        }
    }

@router.get("/users")
def get_all_users(
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Get all users (admin only)"""
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
    role_data: dict,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update user role (admin only)"""
    user = session.get(User, user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self-demotion
    if user.id == current_admin.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Cannot modify your own role")
    
    user.role = role_data.get("role")
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return user