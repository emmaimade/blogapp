from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.models import Comment, ModerationAction, ModerationItem, Post, User


def flag_comment(
    session: Session,
    *,
    comment: Comment,
    reporter: User,
    reason: str,
    notes: Optional[str] = None,
) -> ModerationItem:
    post = session.get(Post, comment.post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    item = _create_or_update_pending_item(
        session,
        blog_id=post.blog_id,
        content_type="comment",
        content_id=comment.id,
        reporter=reporter,
        reason=reason,
        notes=notes,
        snapshot_content=comment.content,
        snapshot_author=comment.user.email if comment.user else None,
    )
    add_audit_log(
        session,
        action="moderation.flag_comment",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=post.blog_id,
        actor=reporter,
        details={"moderation_item_id": item.id, "reason": reason},
    )
    return item


def flag_post(
    session: Session,
    *,
    post: Post,
    reporter: User,
    reason: str,
    notes: Optional[str] = None,
) -> ModerationItem:
    item = _create_or_update_pending_item(
        session,
        blog_id=post.blog_id,
        content_type="post",
        content_id=post.id,
        reporter=reporter,
        reason=reason,
        notes=notes,
        snapshot_content=post.title,
        snapshot_author=post.author.email if post.author else None,
    )
    add_audit_log(
        session,
        action="moderation.flag_post",
        resource_type="post",
        resource_id=post.id,
        blog_id=post.blog_id,
        actor=reporter,
        details={"moderation_item_id": item.id, "reason": reason},
    )
    return item


def record_moderation_action(
    session: Session,
    *,
    item: ModerationItem,
    actor: User,
    action: str,
    notes: Optional[str] = None,
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
    )
    return moderation_action


def load_comment_for_flag(session: Session, comment_id: int) -> Comment:
    statement = select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.user))
    comment = session.exec(statement).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


def load_post_for_flag(session: Session, blog_id: int, post_id: int) -> Post:
    statement = select(Post).where(Post.id == post_id, Post.blog_id == blog_id).options(selectinload(Post.author))
    post = session.exec(statement).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def _create_or_update_pending_item(
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
    item = session.exec(
        select(ModerationItem).where(
            ModerationItem.content_type == content_type,
            ModerationItem.content_id == content_id,
            ModerationItem.status == "pending",
        )
    ).first()

    if item:
        item.reason = reason
        item.notes = notes
        item.updated_at = datetime.utcnow()
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
    return item
