from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import NotFoundError
from app.core.moderation import flag_comment, load_comment_for_flag
from app.core.permissions import require_blog_editor, require_completed_onboarding
from app.core.security import get_current_user, get_current_user_optional
from app.models import Comment, Post, User
from app.schemas import (
    CommentAdminRead,
    CommentCreate,
    CommentRead,
    CommentUpdate,
    FlagContentCreate,
    ModerationQueueItemRead,
)

from . import service

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.post("/", response_model=CommentRead)
def create_comment(
    comment_data: CommentCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create_comment(session, comment_data, current_user, request)


@router.get("/post/{post_id}", response_model=List[CommentRead])
def get_post_comments(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return service.list_post_comments(session, post_id, current_user)


@router.patch("/{comment_id}", response_model=CommentRead)
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.update_comment(session, comment_id, payload, current_user, request)


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    service.delete_comment(session, comment_id, current_user, request)
    return {"ok": True, "message": "Comment deleted successfully"}


@router.post("/{comment_id}/flag", response_model=ModerationQueueItemRead, status_code=201)
def flag_comment_for_moderation(
    comment_id: int,
    payload: FlagContentCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    comment = load_comment_for_flag(session, comment_id)
    item = flag_comment(
        session,
        comment=comment,
        reporter=current_user,
        reason=payload.reason,
        notes=payload.notes,
        request=request,
    )
    session.commit()
    post = session.get(Post, comment.post_id)
    return ModerationQueueItemRead(
        id=item.id,
        blog_id=item.blog_id,
        blog_name=post.blog.name if post and post.blog else "",
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


blog_router = APIRouter(prefix="/blogs/{blog_id}/comments", tags=["Comments"])


@blog_router.get("/", response_model=List[CommentAdminRead])
def get_blog_comments(
    blog_id: int,
    q: Optional[str] = None,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
):
    statement = (
        select(Comment)
        .join(Post, Comment.post_id == Post.id)
        .where(Post.blog_id == blog_id)
        .options(selectinload(Comment.user), selectinload(Comment.post))
        .order_by(Comment.created_at.desc())
    )
    if q:
        statement = statement.where(Comment.content.ilike(f"%{q}%"))
    return session.exec(statement).all()


@blog_router.delete("/{comment_id}")
def moderate_blog_comment(
    blog_id: int,
    comment_id: int,
    request: Request,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Comment)
        .join(Post, Comment.post_id == Post.id)
        .where(Comment.id == comment_id, Post.blog_id == blog_id)
    )
    comment = session.exec(statement).first()
    if not comment:
        raise NotFoundError(ErrorCode.COMMENT_NOT_FOUND)

    comment.content = "[This comment has been deleted by a moderator]"
    comment.is_deleted = True
    comment.updated_at = datetime.utcnow()
    session.add(comment)

    post = session.get(Post, comment.post_id)

    add_audit_log(
        session,
        action="comment.moderator_delete",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=blog_id,
        actor=current_user,
        details={"post_id": comment.post_id, "post_title": post.title if post else None},
        request=request,
    )
    session.commit()
    return {"ok": True, "message": "Comment moderated successfully"}