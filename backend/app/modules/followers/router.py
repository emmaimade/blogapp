from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from sqlmodel import Session

from app.core.config import settings
from app.core.datetimes import utc_now
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import NotFoundError
from app.core.permissions import (
    Permissions,
    get_current_blog,
    get_public_blog,
    require_blog_author,
    require_blog_editor,
    require_blog_owner,
)
from app.core.security import get_current_user
from app.models import Blog, FollowerStatus, Post, User
from app.schemas import (
    FollowAccepted,
    FollowCreate,
    FollowerRead,
    FollowersSettingsUpdate,
    FollowerSummary,
    FollowResult,
    FollowTokenPayload,
    PaginatedResponse,
    PostFollowerEmailRead,
)
from . import emails as follower_emails
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


@router.post("/followers/unsubscribe/one-click")
def unsubscribe_one_click(token: str = Query(..., max_length=200), session: Session = Depends(get_session)):
    """
    RFC 8058 one-click unsubscribe: the mail provider (Gmail, Yahoo) POSTs
    here from the List-Unsubscribe-Post header, without the reader leaving
    their inbox.
    """
    follower_service.unsubscribe(token, session)
    return {"ok": True}


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


@router.get("/blogs/{blog_id}/posts/{post_id}/follower-email", response_model=PostFollowerEmailRead)
def get_post_follower_email(
    blog_id: int,
    post_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
):
    """How emailing a post to the blog's followers is going. Team only: it reveals the audience's size."""
    post = session.get(Post, post_id)
    if not post or post.blog_id != blog_id or not Permissions.can_edit_post(current_user, post, session):
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)
    return PostFollowerEmailRead(
        status=post.follower_email_status,
        notify_followers=post.notify_followers,
        queued_at=post.follower_email_queued_at,
        sent=post.follower_emails_sent,
        recipients=follower_emails.recipients_for(session, post),
        sending_enabled=settings.FOLLOWER_EMAILS_ENABLED,
    )
