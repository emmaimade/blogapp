from typing import Optional

from fastapi import APIRouter, Depends, Header, Response, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.permissions import get_current_blog, get_public_blog
from app.core.security import get_current_user, get_current_user_optional
from app.models import Blog, User
from app.schemas import BlogAnalyticsRead, PostViewCreate, StatsRange
from . import service as analytics_service

router = APIRouter(prefix="/blogs/{blog_id}", tags=["analytics"])


@router.post("/posts/{post_id}/view", status_code=status.HTTP_204_NO_CONTENT)
def record_post_view(
    blog_id: int,
    post_id: int,
    payload: PostViewCreate,
    user_agent: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Called by the public blog once per post per browser session."""
    analytics_service.record_view(blog_id, post_id, payload.new_visitor, user_agent, current_user, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/analytics", response_model=BlogAnalyticsRead)
def get_blog_analytics(
    blog_id: int,
    range: StatsRange = "30d",
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return analytics_service.get_blog_analytics(blog, range, current_user, session)
