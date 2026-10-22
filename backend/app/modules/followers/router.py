from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.permissions import get_public_blog
from app.models import Blog
from app.schemas import FollowAccepted, FollowCreate, FollowResult, FollowTokenPayload
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
