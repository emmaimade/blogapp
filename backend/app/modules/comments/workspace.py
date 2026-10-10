"""
Workspace-side comment moderation: the admin studio's comment list, removing
and restoring comments, and blocking users from commenting.

Owners and editors moderate every comment on the blog. Authors moderate only
comments on their own posts, and can't block users — a block applies to the
whole blog, so it's an owner/editor decision.
"""

from typing import List, Literal, Optional, Tuple

from fastapi import Request
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, BadRequestError, ConflictError, NotFoundError
from app.core.permissions import Permissions
from app.models import BlogCommentBan, BlogRole, Comment, ModerationItem, Post, User
from app.models.comment import CommentDeletedBy
from app.schemas import CommentAdminRead, CommentBanCreate

from .service import soft_delete_comment

CommentStatusFilter = Literal["all", "active", "removed", "reported"]

# Comments deleted before deletion kept the original text had it overwritten
# with a placeholder starting like this — there's nothing to restore.
_LEGACY_PLACEHOLDER_PREFIX = "[This comment has been"


# ── Listing ───────────────────────────────────────────────────────────────────

def list_blog_comments(
    session: Session,
    blog_id: int,
    current_user: User,
    q: Optional[str],
    status: CommentStatusFilter,
    skip: int,
    limit: int,
) -> Tuple[List[CommentAdminRead], int]:
    filters = [Post.blog_id == blog_id]

    author_id = _author_scope(current_user, blog_id, session)
    if author_id is not None:
        filters.append(Post.author_id == author_id)
    if q:
        filters.append(Comment.content.ilike(f"%{q}%"))
    if status == "active":
        filters.append(Comment.is_deleted == False)  # noqa: E712
    elif status == "removed":
        filters.append(Comment.is_deleted == True)  # noqa: E712
    elif status == "reported":
        # A to-do list: once the team has removed a reported comment it's
        # dealt with here, even while the platform report is still pending.
        filters.append(Comment.id.in_(_pending_report_subquery()))
        filters.append(Comment.is_deleted == False)  # noqa: E712

    base = select(Comment).join(Post, Comment.post_id == Post.id).where(*filters)
    total = session.exec(select(func.count()).select_from(base.subquery())).one()
    comments = session.exec(
        base.options(selectinload(Comment.user), selectinload(Comment.post))
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    open_reports = _open_report_counts(session, [c.id for c in comments])
    items = [
        CommentAdminRead.model_validate(c).model_copy(
            update={
                "open_reports": open_reports.get(c.id, 0),
                "can_restore": can_restore(c, current_user),
            }
        )
        for c in comments
    ]
    return items, total


# ── Remove / restore ──────────────────────────────────────────────────────────

def moderate_blog_comment(
    session: Session, blog_id: int, comment_id: int, current_user: User, request: Request
) -> None:
    comment, post = _get_moderatable_comment(session, blog_id, comment_id, current_user)
    if comment.is_deleted:
        raise ConflictError(ErrorCode.COMMENT_DELETED)

    soft_delete_comment(session, comment, CommentDeletedBy.MODERATOR)

    add_audit_log(
        session,
        action="comment.moderator_delete",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=blog_id,
        actor=current_user,
        details={"post_id": post.id, "post_title": post.title},
        request=request,
    )
    session.commit()


def restore_blog_comment(
    session: Session, blog_id: int, comment_id: int, current_user: User, request: Request
) -> Comment:
    comment, post = _get_moderatable_comment(session, blog_id, comment_id, current_user)
    if not comment.is_deleted:
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, "This comment isn't removed.")
    if not can_restore(comment, current_user):
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, _restore_refusal(comment))

    comment.is_deleted = False
    comment.deleted_at = None
    comment.deleted_by = None
    session.add(comment)

    add_audit_log(
        session,
        action="comment.restore",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=blog_id,
        actor=current_user,
        details={"post_id": post.id, "post_title": post.title},
        request=request,
    )
    session.commit()
    session.refresh(comment)
    return comment


def can_restore(comment: Comment, user: User) -> bool:
    """
    Only removals made by moderators are reversible, by moderators:
    - author deletions stand — restoring would override the author;
    - platform (superadmin) removals can only be undone by a superadmin;
    - pre-retention deletions have no original text left.
    """
    if not comment.is_deleted or comment.content.startswith(_LEGACY_PLACEHOLDER_PREFIX):
        return False
    if comment.deleted_by == CommentDeletedBy.MODERATOR:
        return True
    if comment.deleted_by == CommentDeletedBy.PLATFORM:
        return Permissions.is_super_admin(user)
    return False


def _restore_refusal(comment: Comment) -> str:
    if comment.content.startswith(_LEGACY_PLACEHOLDER_PREFIX):
        return "This comment was removed before original text was kept, so it can't be restored."
    if comment.deleted_by == CommentDeletedBy.AUTHOR:
        return "The author deleted this comment, so it can't be restored."
    return "This comment was removed by the platform's moderators and can only be restored by them."


# ── Blocking users ────────────────────────────────────────────────────────────

def list_comment_bans(session: Session, blog_id: int, current_user: User) -> List[BlogCommentBan]:
    _ensure_blog_moderator(current_user, blog_id, session)
    return session.exec(
        select(BlogCommentBan)
        .where(BlogCommentBan.blog_id == blog_id)
        .options(selectinload(BlogCommentBan.user))
        .order_by(BlogCommentBan.created_at.desc())
    ).all()


def ban_commenter(
    session: Session, blog_id: int, payload: CommentBanCreate, current_user: User, request: Request
) -> BlogCommentBan:
    _ensure_blog_moderator(current_user, blog_id, session)

    target = session.get(User, payload.user_id)
    if not target:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)
    if target.id == current_user.id:
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, "You can't block yourself.")
    if Permissions.is_super_admin(target) or Permissions.get_user_role_in_blog(target, blog_id, session):
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "Team members can't be blocked. Remove them from the workspace instead.",
        )

    existing = session.exec(
        select(BlogCommentBan).where(BlogCommentBan.blog_id == blog_id, BlogCommentBan.user_id == target.id)
    ).first()
    if existing:
        raise ConflictError(ErrorCode.RESOURCE_ALREADY_EXISTS, "This person is already blocked from commenting.")

    reason = payload.reason.strip() if payload.reason else None
    ban = BlogCommentBan(blog_id=blog_id, user_id=target.id, banned_by_id=current_user.id, reason=reason or None)
    session.add(ban)
    session.flush()

    add_audit_log(
        session,
        action="comment.ban_user",
        resource_type="user",
        resource_id=target.id,
        blog_id=blog_id,
        actor=current_user,
        details={"username": target.username, "reason": ban.reason},
        request=request,
    )
    session.commit()
    session.refresh(ban)
    return ban


def unban_commenter(
    session: Session, blog_id: int, user_id: int, current_user: User, request: Request
) -> None:
    _ensure_blog_moderator(current_user, blog_id, session)
    ban = session.exec(
        select(BlogCommentBan).where(BlogCommentBan.blog_id == blog_id, BlogCommentBan.user_id == user_id)
    ).first()
    if not ban:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "This person isn't blocked from commenting.")

    session.delete(ban)
    add_audit_log(
        session,
        action="comment.unban_user",
        resource_type="user",
        resource_id=user_id,
        blog_id=blog_id,
        actor=current_user,
        details={},
        request=request,
    )
    session.commit()


# ── Private helpers ───────────────────────────────────────────────────────────

def _author_scope(user: User, blog_id: int, session: Session) -> Optional[int]:
    """None for owners/editors (every comment); the user's id for authors (their posts only)."""
    role = Permissions.get_user_role_in_blog(user, blog_id, session)
    if role in (BlogRole.OWNER, BlogRole.EDITOR):
        return None
    if role == BlogRole.AUTHOR:
        return user.id
    raise AuthorizationError(ErrorCode.INSUFFICIENT_PERMISSIONS)


def _ensure_blog_moderator(user: User, blog_id: int, session: Session) -> None:
    if not Permissions.can_moderate_comments(user, blog_id, session):
        raise AuthorizationError(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only a workspace owner or editor can block people from commenting.",
        )


def _get_moderatable_comment(
    session: Session, blog_id: int, comment_id: int, user: User
) -> Tuple[Comment, Post]:
    row = session.exec(
        select(Comment, Post)
        .join(Post, Comment.post_id == Post.id)
        .where(Comment.id == comment_id, Post.blog_id == blog_id)
    ).first()
    if not row:
        raise NotFoundError(ErrorCode.COMMENT_NOT_FOUND)
    comment, post = row

    author_id = _author_scope(user, blog_id, session)
    if author_id is not None and post.author_id != author_id:
        # An author can't see comments on others' posts in the list either,
        # so this is a 404 rather than a 403.
        raise NotFoundError(ErrorCode.COMMENT_NOT_FOUND)
    return comment, post


def _pending_report_subquery():
    return select(ModerationItem.content_id).where(
        ModerationItem.content_type == "comment", ModerationItem.status == "pending"
    )


def _open_report_counts(session: Session, comment_ids: List[int]) -> dict[int, int]:
    if not comment_ids:
        return {}
    rows = session.exec(
        select(ModerationItem.content_id, ModerationItem.report_count).where(
            ModerationItem.content_type == "comment",
            ModerationItem.status == "pending",
            ModerationItem.content_id.in_(comment_ids),
        )
    ).all()
    return {content_id: count for content_id, count in rows}
