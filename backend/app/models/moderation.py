from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ModerationItem(SQLModel, table=True):
    __tablename__ = "moderation_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(index=True)
    content_type: str = Field(index=True)
    content_id: int = Field(index=True)
    status: str = Field(default="pending", index=True)
    reason: str
    notes: Optional[str] = None
    snapshot_content: str
    snapshot_author: Optional[str] = None
    reported_by_id: Optional[int] = Field(default=None, index=True)
    resolved_by_id: Optional[int] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
    resolved_at: Optional[datetime] = None


class ModerationAction(SQLModel, table=True):
    __tablename__ = "moderation_actions"

    id: Optional[int] = Field(default=None, primary_key=True)
    moderation_item_id: int = Field(index=True)
    actor_user_id: Optional[int] = Field(default=None, index=True)
    action: str = Field(index=True)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
