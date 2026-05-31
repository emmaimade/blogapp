from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.moderation import flag_comment, load_comment_for_flag
from app.core.permissions import require_blog_editor, require_completed_onboarding
from app.core.security import get_current_user
from app.models import Comment, Post, User, PlatformRole
from app.schemas import CommentAdminRead, CommentCreate, CommentRead, FlagContentCreate, ModerationQueueItemRead

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.post("/", response_model=CommentRead)
def create_comment(
    comment_data: CommentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if comment_data.parent_id == 0:
        comment_data.parent_id = None

    post = session.get(Post, comment_data.post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post with ID {comment_data.post_id} not found")

    new_comment = Comment(**comment_data.model_dump())
    new_comment.user_id = current_user.id

    session.add(new_comment)
    session.flush()
    add_audit_log(
        session,
        action="comment.create",
        resource_type="comment",
        resource_id=new_comment.id,
        blog_id=post.blog_id,
        actor=current_user,
        details={"post_id": post.id},
    )
    session.commit()
    session.refresh(new_comment)

    statement = select(Comment).where(Comment.id == new_comment.id).options(selectinload(Comment.replies))
    new_comment = session.exec(statement).first()

    return new_comment


@router.get("/post/{post_id}", response_model=List[CommentRead])
def get_post_comments(post_id: int, session: Session = Depends(get_session)):
    statement = select(Comment).where(Comment.post_id == post_id, Comment.parent_id == None)
    return session.exec(statement).all()


@router.patch("/{comment_id}", response_model=CommentRead)
def update_comment(
    comment_id: int,
    content: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.user))
    comment = session.exec(statement).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to edit this comment")

    comment.content = content

    session.add(comment)
    add_audit_log(
        session,
        action="comment.update",
        resource_type="comment",
        resource_id=comment.id,
        actor=current_user,
        details={"post_id": comment.post_id},
    )
    session.commit()
    session.refresh(comment)
    return comment


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    comment = session.get(Comment, comment_id)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_author = comment.user_id == current_user.id
    is_admin = current_user.is_super_admin or current_user.platform_role == PlatformRole.SUPER_ADMIN

    if not (is_author or is_admin):
        raise HTTPException(
            status_code=403,
            detail="Moderator privileges or ownership required to delete this content",
        )

    if is_author:
        comment.content = "[This comment has been deleted by the author]"
    elif is_admin:
        comment.content = "[This comment has been deleted by a moderator]"
    comment.is_deleted = True

    session.add(comment)
    add_audit_log(
        session,
        action="comment.delete",
        resource_type="comment",
        resource_id=comment.id,
        actor=current_user,
        details={"post_id": comment.post_id, "deleted_by": "author" if is_author else "moderator"},
    )
    session.commit()
    return {"ok": True, "message": "Comment moderated successfully"}


@router.post("/{comment_id}/flag", response_model=ModerationQueueItemRead, status_code=201)
def flag_comment_for_moderation(
    comment_id: int,
    payload: FlagContentCreate,
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
    return session.exec(statement).all()


@blog_router.delete("/{comment_id}")
def moderate_blog_comment(
    blog_id: int,
    comment_id: int,
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
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.content = "[This comment has been deleted by a moderator]"
    comment.is_deleted = True
    comment.updated_at = datetime.utcnow()
    session.add(comment)
    add_audit_log(
        session,
        action="comment.moderator_delete",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=blog_id,
        actor=current_user,
        details={"post_id": comment.post_id},
    )
    session.commit()
    return {"ok": True, "message": "Comment moderated successfully"}
