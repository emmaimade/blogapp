from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session

from app.core.db import get_session
from app.core.moderation import flag_comment, load_comment_for_flag
from app.core.permissions import require_blog_author, require_blog_editor, require_completed_onboarding
from app.core.security import get_current_user, get_current_user_optional
from app.models import Post, User
from app.schemas import (
    CommentAdminRead,
    CommentBanCreate,
    CommentBanRead,
    CommentCreate,
    CommentRead,
    CommentThreadPage,
    CommentUpdate,
    FlagContentCreate,
    ModerationQueueItemRead,
    PaginatedResponse,
)

from . import service, workspace
from .workspace import CommentStatusFilter

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.post("/", response_model=CommentRead)
def create_comment(
    comment_data: CommentCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create_comment(session, comment_data, current_user, request)


@router.get("/post/{post_id}", response_model=CommentThreadPage)
def get_post_comments(
    post_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    items, total, comment_count = service.list_post_comments(session, post_id, current_user, skip, limit)
    return CommentThreadPage(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=skip + len(items) < total,
        comment_count=comment_count,
    )


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
        report_count=item.report_count,
        created_at=item.created_at,
    )


blog_router = APIRouter(prefix="/blogs/{blog_id}/comments", tags=["Comments"])


@blog_router.get("/", response_model=PaginatedResponse[CommentAdminRead])
def get_blog_comments(
    blog_id: int,
    q: Optional[str] = None,
    status: CommentStatusFilter = "all",
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
    current_user: User = Depends(get_current_user),
):
    items, total = workspace.list_blog_comments(session, blog_id, current_user, q, status, skip, limit)
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)


@blog_router.get("/bans", response_model=List[CommentBanRead])
def list_comment_bans(
    blog_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
    current_user: User = Depends(get_current_user),
):
    return workspace.list_comment_bans(session, blog_id, current_user)


@blog_router.post("/bans", response_model=CommentBanRead, status_code=201)
def ban_commenter(
    blog_id: int,
    payload: CommentBanCreate,
    request: Request,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    return workspace.ban_commenter(session, blog_id, payload, current_user, request)


@blog_router.delete("/bans/{user_id}")
def unban_commenter(
    blog_id: int,
    user_id: int,
    request: Request,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_editor),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    workspace.unban_commenter(session, blog_id, user_id, current_user, request)
    return {"ok": True, "message": "Unblocked"}


@blog_router.delete("/{comment_id}")
def moderate_blog_comment(
    blog_id: int,
    comment_id: int,
    request: Request,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    workspace.moderate_blog_comment(session, blog_id, comment_id, current_user, request)
    return {"ok": True, "message": "Comment moderated successfully"}


@blog_router.post("/{comment_id}/restore", response_model=CommentAdminRead)
def restore_blog_comment(
    blog_id: int,
    comment_id: int,
    request: Request,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_author),
    __: None = Depends(require_completed_onboarding),
    current_user: User = Depends(get_current_user),
):
    return workspace.restore_blog_comment(session, blog_id, comment_id, current_user, request)
