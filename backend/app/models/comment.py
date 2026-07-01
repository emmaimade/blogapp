from datetime import datetime, timezone
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str
    is_deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"onupdate": utcnow},
    )

    post_id: int = Field(foreign_key="post.id", ondelete="CASCADE")
    post: "Post" = Relationship(back_populates="comments")

    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    user: "User" = Relationship()

    parent_id: Optional[int] = Field(default=None, foreign_key="comment.id", ondelete="CASCADE")
    replies: List["Comment"] = Relationship(
        sa_relationship_kwargs={
            "remote_side": "Comment.id",
            "lazy": "selectin",
            "join_depth": 3,
        }
    )
