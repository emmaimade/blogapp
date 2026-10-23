from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from sqlmodel import Session

from app.core.datetimes import utc_now
from app.core.db import get_session
from app.core.permissions import get_current_blog, get_public_blog, require_blog_editor
from app.core.security import get_current_user, get_current_user_optional
from app.models import Blog, User
from app.schemas import (
    AnalyticsOverviewRead,
    AnalyticsPostRow,
    AnalyticsPostSort,
    BlogAnalyticsRead,
    PaginatedResponse,
    PostViewCreate,
    StatsRange,
)
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
    analytics_service.record_view(
        blog_id, post_id, payload.new_visitor, user_agent, current_user, session, referrer=payload.referrer,
    )
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


# ── The studio's Analytics page: owners and editors ──────────────────────────

@router.get("/analytics/overview", response_model=AnalyticsOverviewRead)
def get_analytics_overview(
    blog_id: int,
    range: StatsRange = "30d",
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    return analytics_service.get_analytics_overview(blog, range, current_user, session)


@router.get("/analytics/posts", response_model=PaginatedResponse[AnalyticsPostRow])
def list_post_analytics(
    blog_id: int,
    range: StatsRange = "30d",
    sort: AnalyticsPostSort = "views",
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    items, total = analytics_service.list_post_analytics(blog, range, sort, skip, limit, current_user, session)
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)


@router.get("/analytics/export")
def export_analytics(
    blog_id: int,
    request: Request,
    range: StatsRange = "30d",
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    """Daily rows as CSV. Pro and Team plans."""
    content = analytics_service.export_analytics_csv(blog, range, current_user, request, session)
    filename = f"{blog.slug}-analytics-{range}-{utc_now().date().isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
