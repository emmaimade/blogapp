"""
Comment business rules — who may comment where, what a reply may attach to,
and what can still be changed once a comment is deleted. The router stays a
thin HTTP layer over these.
"""

from typing import List, Optional

from fastapi import Request
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, BadRequestError, ConflictError, NotFoundError
from app.core.notifications import add_notification
from app.core.permissions import Permissions
from app.models import Blog, BlogRole, Comment, Post, User
from app.models.post import PostStatus
from app.schemas import CommentCreate, CommentUpdate


# ── Public operations ─────────────────────────────────────────────────────────

def create_comment(
    session: Session, payload: CommentCreate, current_user: User, request: Request
) -> Comment:
    _ensure_platform_comments_enabled(session)
    post = _get_commentable_post(session, payload.post_id)
    parent_id = _resolve_reply_parent(session, payload.parent_id, post.id)

    comment = Comment(
        content=payload.content,
        post_id=post.id,
        parent_id=parent_id,
        user_id=current_user.id,
    )
    session.add(comment)
    session.flush()

    add_audit_log(
        session,
        action="comment.create",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=post.blog_id,
        actor=current_user,
        details={
            "post_id": post.id,
            "post_title": post.title,
            "commenter_role": _commenter_role_label(current_user, post.blog_id, session),
        },
        request=request,
    )

    if post.author_id and post.author_id != current_user.id:
        add_notification(
            session,
            user_id=post.author_id,
            blog_id=post.blog_id,
            type="comment_created",
            title=f'New comment on "{post.title}"',
            body=f"{current_user.first_name} {current_user.last_name} commented on your post",
            link=f"/admin/posts/view/{post.id}?blog={post.blog_id}",
        )

    session.commit()
    return _load_comment(session, comment.id)


def list_post_comments(
    session: Session, post_id: int, current_user: Optional[User]
) -> List[Comment]:
    post = session.get(Post, post_id)
    blog = session.get(Blog, post.blog_id) if post else None
    if not post or not blog or not blog.is_active:
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)

    # Same rule as reading the post itself: an unpublished post's thread is
    # indistinguishable from a missing one to anyone outside the workspace.
    if post.status != PostStatus.PUBLISHED and not _is_workspace_writer(current_user, post.blog_id, session):
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)

    statement = select(Comment).where(Comment.post_id == post_id, Comment.parent_id == None)  # noqa: E711
    return session.exec(statement).all()


def update_comment(
    session: Session,
    comment_id: int,
    payload: CommentUpdate,
    current_user: User,
    request: Request,
) -> Comment:
    comment = _load_comment(session, comment_id)

    if comment.user_id != current_user.id:
        raise AuthorizationError(ErrorCode.FORBIDDEN, "You can only edit your own comments.")

    # Without this an author could PATCH a moderator-redacted comment and
    # restore the text that was removed.
    if comment.is_deleted:
        raise ConflictError(ErrorCode.COMMENT_DELETED)

    comment.content = payload.content
    session.add(comment)

    # Comments don't carry blog_id directly — resolve it through the parent
    # post so this entry actually shows up in the workspace's audit log.
    post = session.get(Post, comment.post_id)

    add_audit_log(
        session,
        action="comment.update",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=post.blog_id if post else None,
        actor=current_user,
        details={"post_id": comment.post_id, "post_title": post.title if post else None},
        request=request,
    )
    session.commit()
    return _load_comment(session, comment.id)


def delete_comment(
    session: Session, comment_id: int, current_user: User, request: Request
) -> None:
    comment = session.get(Comment, comment_id)
    if not comment:
        raise NotFoundError(ErrorCode.COMMENT_NOT_FOUND)

    is_author = comment.user_id == current_user.id
    is_admin = Permissions.is_super_admin(current_user)

    if not (is_author or is_admin):
        raise AuthorizationError(ErrorCode.FORBIDDEN, "You can only delete your own comments.")

    if comment.is_deleted:
        raise ConflictError(ErrorCode.COMMENT_DELETED)

    if is_author:
        comment.content = "[This comment has been deleted by the author]"
    else:
        comment.content = "[This comment has been deleted by a moderator]"
    comment.is_deleted = True
    session.add(comment)

    # Same as update_comment — resolve blog_id through the post so the
    # deletion lands in the workspace-scoped audit log.
    post = session.get(Post, comment.post_id)

    add_audit_log(
        session,
        action="comment.delete",
        resource_type="comment",
        resource_id=comment.id,
        blog_id=post.blog_id if post else None,
        actor=current_user,
        details={
            "post_id": comment.post_id,
            "post_title": post.title if post else None,
            "deleted_by": "author" if is_author else "moderator",
        },
        request=request,
    )
    session.commit()


# ── Private helpers ───────────────────────────────────────────────────────────

def _ensure_platform_comments_enabled(session: Session) -> None:
    # Imported lazily: platform settings are only loaded by the superadmin
    # module today, and pulling that router in at import time would make
    # this module depend on everything it imports.
    from app.modules.superadmin.router import _load_platform_settings

    if not _load_platform_settings(session).feature_comments:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "Comments are currently disabled across the platform.",
        )


def _get_commentable_post(session: Session, post_id: int) -> Post:
    post = session.get(Post, post_id)
    blog = session.get(Blog, post.blog_id) if post else None

    # Drafts, scheduled posts and deactivated blogs all 404 rather than 400,
    # so the endpoint can't be used to probe for unpublished post IDs.
    if not post or not blog or not blog.is_active or post.status != PostStatus.PUBLISHED:
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)

    if not blog.comments_enabled:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "Comments are disabled for this blog.",
        )
    return post


def _resolve_reply_parent(session: Session, parent_id: Optional[int], post_id: int) -> Optional[int]:
    """
    Threads are one level deep: a reply to a reply is attached to the
    top-level comment it sits under. Returns the parent_id to store.
    """
    # Older clients send 0 to mean "no parent".
    if not parent_id:
        return None

    parent = session.get(Comment, parent_id)
    if not parent or parent.post_id != post_id:
        raise BadRequestError(ErrorCode.INVALID_INPUT, "You can only reply to a comment on this post.")
    if parent.is_deleted:
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, "You can't reply to a deleted comment.")

    return parent.parent_id or parent.id


def _load_comment(session: Session, comment_id: int) -> Comment:
    statement = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.user), selectinload(Comment.replies))
    )
    comment = session.exec(statement).first()
    if not comment:
        raise NotFoundError(ErrorCode.COMMENT_NOT_FOUND)
    return comment


def _is_workspace_writer(user: Optional[User], blog_id: int, session: Session) -> bool:
    if not user:
        return False
    role = Permissions.get_user_role_in_blog(user, blog_id, session)
    return role in [BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]


def _commenter_role_label(current_user: User, blog_id: int, session: Session) -> str:
    """
    Distinguishes a workspace team member (owner/editor/author) commenting
    on their own blog from an ordinary registered reader — the public blog
    requires an account to comment, but most commenters aren't team members.
    """
    role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
    return getattr(role, "value", role) or "reader"
