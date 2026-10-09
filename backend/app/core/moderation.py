from typing import Optional

from fastapi import Request
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.error_codes import ErrorCode
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models import Comment, ModerationAction, ModerationItem, ModerationReport, Post, User
from app.models.moderation import utcnow
from app.services.content_throttle import check_report_allowed


def flag_comment(
    session: Session,
    *,
    comment: Comment,
    reporter: User,
    reason: str,
    notes: Optional[str] = None,
    request: Request | None = None,
) -> ModerationItem:
    post = session.get(Post, comment.post_id)
    if not post:
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)
    if comment.user_id == reporter.id:
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, "You can't report your own comment.")
    if comment.is_deleted:
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, "This comment has already been removed.")
    check_report_allowed(session, reporter.id)

    item = _record_report(
        session,
        blog_id=post.blog_id,
        content_type="comment",
        content_id=comment.id,
        reporter=reporter,
        reason=reason,
        notes=notes,
        snapshot_content=comment.content,
        # Username, not email: the snapshot is shown in moderation views and
        # an email address isn't needed to judge the content.
        snapshot_author=comment.user.username if comment.user else None,
    )
    add_audit_log(
        session,
        action="moderation.flag_comment",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=post.blog_id,
        actor=reporter,
        details={"moderation_item_id": item.id, "reason": reason},
        request=request,
    )
    return item


def flag_post(
    session: Session,
    *,
    post: Post,
    reporter: User,
    reason: str,
    notes: Optional[str] = None,
    request: Request | None = None,
) -> ModerationItem:
    check_report_allowed(session, reporter.id)

    item = _record_report(
        session,
        blog_id=post.blog_id,
        content_type="post",
        content_id=post.id,
        reporter=reporter,
        reason=reason,
        notes=notes,
        snapshot_content=post.title,
        snapshot_author=post.author.username if post.author else None,
    )
    add_audit_log(
        session,
        action="moderation.flag_post",
        resource_type="post",
        resource_id=post.id,
        blog_id=post.blog_id,
        actor=reporter,
        details={"moderation_item_id": item.id, "reason": reason},
        request=request,
    )
    return item


def record_moderation_action(
    session: Session,
    *,
    item: ModerationItem,
    actor: User,
    action: str,
    notes: Optional[str] = None,
    request: Request | None = None,
) -> ModerationAction:
    moderation_action = ModerationAction(
        moderation_item_id=item.id,
        actor_user_id=actor.id,
        action=action,
        notes=notes,
    )
    session.add(moderation_action)
    add_audit_log(
        session,
        action=f"moderation.{action}",
        resource_type=item.content_type,
        resource_id=item.content_id,
        blog_id=item.blog_id,
        actor=actor,
        details={"moderation_item_id": item.id, "notes": notes},
        request=request,
    )
    return moderation_action


def load_comment_for_flag(session: Session, comment_id: int) -> Comment:
    statement = select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.user))
    comment = session.exec(statement).first()
    if not comment:
        raise NotFoundError(ErrorCode.COMMENT_NOT_FOUND)
    return comment


def load_post_for_flag(session: Session, blog_id: int, post_id: int) -> Post:
    statement = select(Post).where(Post.id == post_id, Post.blog_id == blog_id).options(selectinload(Post.author))
    post = session.exec(statement).first()
    if not post:
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)
    return post


def _record_report(
    session: Session,
    *,
    blog_id: int,
    content_type: str,
    content_id: Optional[int],
    reporter: User,
    reason: str,
    notes: Optional[str],
    snapshot_content: str,
    snapshot_author: Optional[str],
) -> ModerationItem:
    """
    Files `reporter`'s report against the content's pending moderation item,
    opening one if there isn't one yet. Each person can report an item once;
    further reporters raise `report_count` rather than replacing the first
    report's reason.
    """
    item = session.exec(
        select(ModerationItem).where(
            ModerationItem.content_type == content_type,
            ModerationItem.content_id == content_id,
            ModerationItem.status == "pending",
        )
    ).first()

    if item:
        already_reported = session.exec(
            select(ModerationReport.id).where(
                ModerationReport.moderation_item_id == item.id,
                ModerationReport.reporter_id == reporter.id,
            )
        ).first()
        if already_reported is not None:
            raise ConflictError(ErrorCode.ALREADY_REPORTED)
        item.report_count += 1
        item.updated_at = utcnow()
    else:
        item = ModerationItem(
            blog_id=blog_id,
            content_type=content_type,
            content_id=content_id,
            reported_by_id=reporter.id,
            reason=reason,
            notes=notes,
            snapshot_content=snapshot_content,
            snapshot_author=snapshot_author,
        )

    session.add(item)
    session.flush()
    session.add(ModerationReport(moderation_item_id=item.id, reporter_id=reporter.id, reason=reason, notes=notes))
    session.flush()
    return item
