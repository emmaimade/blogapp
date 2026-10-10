from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime as SQLDateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BlogCommentBan(SQLModel, table=True):
    """A user a workspace has blocked from commenting on its blog."""
    __tablename__ = "blog_comment_bans"
    __table_args__ = (
        UniqueConstraint("blog_id", "user_id", name="uq_blog_comment_bans_blog_user"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(index=True, foreign_key="blog.id", ondelete="CASCADE")
    user_id: int = Field(index=True, foreign_key="user.id", ondelete="CASCADE")
    banned_by_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="SET NULL")
    reason: Optional[str] = None
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )

    user: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "[BlogCommentBan.user_id]"})
