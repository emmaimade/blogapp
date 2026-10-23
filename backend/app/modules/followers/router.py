from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from sqlmodel import Session

from app.core.datetimes import utc_now
from app.core.db import get_session
from app.core.permissions import get_current_blog, get_public_blog, require_blog_editor, require_blog_owner
from app.core.security import get_current_user
from app.models import Blog, FollowerStatus, User
from app.schemas import (
    FollowAccepted,
    FollowCreate,
    FollowerRead,
    FollowersSettingsUpdate,
    FollowerSummary,
    FollowResult,
    FollowTokenPayload,
    PaginatedResponse,
)
from . import service as follower_service

router = APIRouter(tags=["followers"])


@router.post("/blogs/{blog_id}/followers", response_model=FollowAccepted, status_code=status.HTTP_202_ACCEPTED)
def follow_blog(
    blog_id: int,
    payload: FollowCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
):
    """The blog's follow form. Same answer whatever the address's state."""
    follower_service.follow(blog, payload, background_tasks, session)
    return FollowAccepted(message=follower_service.FOLLOW_ACCEPTED_MESSAGE)


@router.post("/followers/confirm", response_model=FollowResult)
def confirm_follow(payload: FollowTokenPayload, session: Session = Depends(get_session)):
    """From the marketing site's /follow/confirm page, with the emailed token."""
    return FollowResult(blog_name=follower_service.confirm(payload.token, session))


@router.post("/followers/unsubscribe", response_model=FollowResult)
def unsubscribe_follower(payload: FollowTokenPayload, session: Session = Depends(get_session)):
    """From the marketing site's /follow/unsubscribe page."""
    return FollowResult(blog_name=follower_service.unsubscribe(payload.token, session))


# ── Studio: the Audience page ────────────────────────────────────────────────
# Only DELETE takes a follower id, so the fixed GET paths ("summary",
# "export") never collide with one.

@router.get("/blogs/{blog_id}/followers/summary", response_model=FollowerSummary)
def get_follower_summary(
    blog_id: int,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    return follower_service.follower_summary(blog, current_user, session)


@router.get("/blogs/{blog_id}/followers", response_model=PaginatedResponse[FollowerRead])
def list_followers(
    blog_id: int,
    status: Optional[FollowerStatus] = None,
    q: Optional[str] = Query(None, max_length=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    items, total = follower_service.list_followers(blog_id, status, q, skip, limit, session)
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)


@router.get("/blogs/{blog_id}/followers/export")
def export_followers(
    blog_id: int,
    request: Request,
    status: Optional[FollowerStatus] = None,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """CSV download: the owner's, or an editor's granted export_followers."""
    content = follower_service.export_followers_csv(blog, status, current_user, request, session)
    filename = f"{blog.slug}-followers-{utc_now().date().isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/blogs/{blog_id}/followers/{follower_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_follower(
    blog_id: int,
    follower_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    follower_service.remove_follower(blog_id, follower_id, current_user, request, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/blogs/{blog_id}/followers/settings", response_model=FollowersSettingsUpdate)
def update_followers_settings(
    blog_id: int,
    payload: FollowersSettingsUpdate,
    request: Request,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    """The blog's follow form on/off switch. Owner only."""
    enabled = follower_service.set_followers_enabled(blog, payload.followers_enabled, current_user, request, session)
    return FollowersSettingsUpdate(followers_enabled=enabled)
