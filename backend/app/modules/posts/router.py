from typing import List, Optional

from fastapi import APIRouter, Depends, File, UploadFile
from sqlmodel import Session

from app.core.db import get_session
from app.core.moderation import flag_post, load_post_for_flag
from app.core.security import get_current_user, get_current_user_optional
from app.core.permissions import get_public_blog, require_blog_author, require_completed_onboarding
from app.models import User, Blog
from app.schemas import FlagContentCreate, ModerationQueueItemRead, PostCreate, PostRead, PostUpdate
from . import service as post_service

router = APIRouter(prefix="/blogs/{blog_id}/posts", tags=["posts"])


@router.post("/upload-image")
def upload_post_image(
    blog_id: int,
    file: UploadFile = File(...),
    _: None = Depends(require_blog_author),
    __: None = Depends(require_completed_onboarding),
):
    return post_service.upload_post_image(file)


@router.post("/", response_model=PostRead)
def create_post(
    blog_id: int,
    post_data: PostCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    return post_service.create_post(blog_id, post_data, session, current_user)


@router.get("/", response_model=List[PostRead])
def read_posts(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
    current_user: Optional[User] = Depends(get_current_user_optional),
    filter: Optional[str] = None,
):
    return post_service.read_posts(blog_id, session, current_user, filter)


@router.get("/search", response_model=List[PostRead])
def search_posts(
    blog_id: int,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
):
    return post_service.search_posts(blog_id, session, q, tag)


@router.patch("/{post_id}", response_model=PostRead)
def update_post(
    blog_id: int,
    post_id: int,
    post_data: PostUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    return post_service.update_post(blog_id, post_id, post_data, session, current_user)


@router.delete("/{post_id}")
def delete_post(
    blog_id: int,
    post_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    return post_service.delete_post(blog_id, post_id, session, current_user)


@router.post("/{post_id}/flag", response_model=ModerationQueueItemRead, status_code=201)
def flag_post_for_moderation(
    blog_id: int,
    post_id: int,
    payload: FlagContentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    post = load_post_for_flag(session, blog_id, post_id)
    item = flag_post(
        session,
        post=post,
        reporter=current_user,
        reason=payload.reason,
        notes=payload.notes,
    )
    session.commit()
    return ModerationQueueItemRead(
        id=item.id,
        blog_id=item.blog_id,
        blog_name=post.blog.name if post.blog else "",
        item_type=item.content_type,
        content_id=item.content_id,
        author=item.snapshot_author or "Unknown",
        content=item.snapshot_content,
        reason=item.reason,
        notes=item.notes,
        status=item.status,
        reported_by_id=item.reported_by_id,
        created_at=item.created_at,
    )


@router.get("/{post_id}", response_model=PostRead)
def read_post(
    blog_id: int, 
    post_id: int, 
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog)
):
    return post_service.read_post(blog_id, post_id, session)


@router.get("/slug/{slug}", response_model=PostRead)
def read_post_by_slug(
    blog_id: int,
    slug: str,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return post_service.read_post_by_slug(blog_id, slug, session, current_user)
