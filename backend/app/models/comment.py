from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, DateTime as SQLDateTime, String
from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CommentDeletedBy(str, Enum):
    AUTHOR    = "author"
    MODERATOR = "moderator"   # a workspace owner/editor
    PLATFORM  = "platform"    # a superadmin, via the moderation queue


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str
    is_deleted: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, onupdate=utcnow),
    )
    edited_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(SQLDateTime(timezone=True)),
        description="UTC datetime of the author's last edit to the content.",
    )
    # A deleted comment keeps its original `content` so moderators can review
    # or restore it; public responses swap in a placeholder (see CommentRead).
    deleted_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(SQLDateTime(timezone=True)),
    )
    # Stored as a plain string (one of CommentDeletedBy) rather than a native
    # enum type, so adding a value later doesn't need a type migration.
    deleted_by: Optional[str] = Field(default=None, sa_column=Column(String(16)))

    post_id: int = Field(foreign_key="post.id", ondelete="CASCADE", index=True)
    post: "Post" = Relationship(back_populates="comments")

    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    user: "User" = Relationship()

    parent_id: Optional[int] = Field(
        default=None, foreign_key="comment.id", ondelete="CASCADE", index=True
    )
    # One-to-many: a top-level comment's replies. Threads are one level deep
    # (see comments.service._resolve_reply_parent), so eager-loading stops at
    # depth 1. (This used to set remote_side=Comment.id, which made it the
    # many-to-one *parent* link — replies were never actually returned.)
    replies: List["Comment"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "join_depth": 1,
            "order_by": "Comment.created_at, Comment.id",
        }
    )