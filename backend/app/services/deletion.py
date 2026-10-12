"""
Permanent deletion of workspaces and accounts, and the rules around it.

Account deletion is two-step: a delete is soft (`User.deleted_at`) and can be
undone for SOFT_DELETE_RETENTION_DAYS; after that the nightly purge erases the
row for good. An account that still owns a workspace other people use can't be
deleted at all until ownership moves on - erasing it would take everyone
else's workspace with it.
"""

from datetime import datetime, timedelta

from sqlmodel import Session, delete, select

from app.core.datetimes import as_utc
from app.core.error_codes import ErrorCode
from app.core.exceptions import BadRequestError
from app.models import Blog, BlogMember, Post, User

# How long a soft-deleted account can be restored before it is purged.
# The admin studio mirrors this (SOFT_DELETE_RETENTION_DAYS) to show purge dates.
SOFT_DELETE_RETENTION_DAYS = 30


def deleted_prefix(user_id: int) -> str:
    # A superadmin delete renames the account this way to free its username/email.
    return f"deleted_{user_id}_"


def restore_deadline(deleted_at: datetime) -> datetime:
    """The moment a soft-deleted account stops being restorable."""
    return as_utc(deleted_at) + timedelta(days=SOFT_DELETE_RETENTION_DAYS)


def shared_owned_workspaces(session: Session, user_id: int) -> list[Blog]:
    """Workspaces the user owns that have at least one other member."""
    others = select(BlogMember.blog_id).where(BlogMember.user_id != user_id)
    return list(
        session.exec(select(Blog).where(Blog.owner_id == user_id, Blog.id.in_(others)).order_by(Blog.name)).all()
    )


def ensure_account_deletable(session: Session, user: User, *, subject: str) -> None:
    """
    Refuse to delete an account that owns a workspace other people use.

    `subject` starts the message: "You" for a self-delete, the person's name
    when a superadmin is deleting someone.
    """
    shared = shared_owned_workspaces(session, user.id)
    if not shared:
        return
    names = ", ".join(f'"{blog.name}"' for blog in shared)
    noun, pronoun = ("a workspace", "it") if len(shared) == 1 else ("workspaces", "them")
    raise BadRequestError(
        ErrorCode.OPERATION_NOT_ALLOWED,
        f"{subject} still own{'' if subject == 'You' else 's'} {noun} other people use ({names}). "
        f"Transfer ownership of {pronoun} first.",
    )


def delete_blog_permanently(session: Session, blog: Blog) -> None:
    """
    Erase a workspace and everything in it. Doesn't commit.

    Posts and memberships go through the ORM (which clears posts' tag links);
    everything else keyed by blog_id goes by the database's ON DELETE CASCADE.
    session.delete(blog) would instead have the ORM set those NOT NULL
    blog_ids to null first, and fail.
    """
    for post in session.exec(select(Post).where(Post.blog_id == blog.id)).all():
        session.delete(post)
    for member in session.exec(select(BlogMember).where(BlogMember.blog_id == blog.id)).all():
        session.delete(member)
    session.flush()
    session.expunge(blog)
    session.exec(delete(Blog).where(Blog.id == blog.id))


def purge_account(session: Session, user_id: int) -> None:
    """
    Erase a soft-deleted account for good. Doesn't commit.

    Workspaces it owns go with it (callers make sure none are shared). Its
    memberships, comments, notifications and tokens go by ON DELETE CASCADE;
    posts it wrote elsewhere stay, with author_id set to null.
    """
    for blog in session.exec(select(Blog).where(Blog.owner_id == user_id)).all():
        delete_blog_permanently(session, blog)
    # A bulk delete for the same reason as above: the ORM would null the
    # user's NOT NULL foreign keys instead of letting the database cascade.
    session.exec(delete(User).where(User.id == user_id))
