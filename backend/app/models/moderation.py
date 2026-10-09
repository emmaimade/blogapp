from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime as SQLDateTime, UniqueConstraint
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
    # The first report's reason/notes. Later reporters are counted, not
    # merged in — each one's own reason lives on its ModerationReport.
    reason: str
    notes: Optional[str] = None
    report_count: int = Field(default=1)
    snapshot_content: str
    snapshot_author: Optional[str] = None
    reported_by_id: Optional[int] = Field(default=None, 
        foreign_key="user.id", 
        ondelete="SET NULL")
    resolved_by_id: Optional[int] = Field(default=None, 
        foreign_key="user.id", 
        ondelete="SET NULL")
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, onupdate=utcnow),
    )
    resolved_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))


class ModerationReport(SQLModel, table=True):
    """One person's report against a moderation item — at most one each."""
    __tablename__ = "moderation_reports"
    __table_args__ = (
        UniqueConstraint("moderation_item_id", "reporter_id", name="uq_moderation_reports_item_reporter"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    moderation_item_id: int = Field(index=True, foreign_key="moderation_items.id", ondelete="CASCADE")
    reporter_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id", ondelete="SET NULL")
    reason: str
    notes: Optional[str] = None
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )


class ModerationAction(SQLModel, table=True):
    __tablename__ = "moderation_actions"

    id: Optional[int] = Field(default=None, primary_key=True)
    moderation_item_id: int = Field(index=True, foreign_key="moderation_items.id", ondelete="CASCADE")
    actor_user_id: Optional[int] = Field(default=None, index=True)
    action: str = Field(index=True)
    notes: Optional[str] = None
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )