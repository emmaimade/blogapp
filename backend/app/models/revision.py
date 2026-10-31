"""
Saved versions of a post, for the editor's History panel: one per save that
changed the article (and on going live), the newest 30 kept per post.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime as SQLDateTime, Text
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PostRevision(SQLModel, table=True):
    __tablename__ = "post_revisions"

    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="post.id", index=True, ondelete="CASCADE")
    title: str
    content: str = Field(sa_column=Column(Text, nullable=False))
    thumbnail_url: Optional[str] = None
    # SET NULL: a version outlives its author's account, like the post does.
    saved_by_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="SET NULL")
    # "saved", "published" or "restored"
    reason: str = Field(default="saved", max_length=20)
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )
