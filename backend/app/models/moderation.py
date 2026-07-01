from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ModerationItem(SQLModel, table=True):
    __tablename__ = "moderation_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(index=True, foreign_key="blog.id", ondelete="CASCADE")
    content_type: str = Field(index=True)
    content_id: int = Field(index=True)
    status: str = Field(default="pending", index=True)
    reason: str
    notes: Optional[str] = None
    snapshot_content: str
    snapshot_author: Optional[str] = None
    reported_by_id: Optional[int] = Field(default=None, 
        foreign_key="user.id", 
        ondelete="SET NULL")
    resolved_by_id: Optional[int] = Field(default=None, 
        foreign_key="user.id", 
        ondelete="SET NULL")
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"onupdate": utcnow},
    )
    resolved_at: Optional[datetime] = None


class ModerationAction(SQLModel, table=True):
    __tablename__ = "moderation_actions"

    id: Optional[int] = Field(default=None, primary_key=True)
    moderation_item_id: int = Field(index=True, foreign_key="moderation_items.id", ondelete="CASCADE")
    actor_user_id: Optional[int] = Field(default=None, index=True)
    action: str = Field(index=True)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow, index=True)
