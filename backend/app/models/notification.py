from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime as SQLDateTime
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    blog_id: Optional[int] = Field(default=None, foreign_key="blog.id", ondelete="SET NULL", index=True)

    type: str = Field(index=True)  # e.g. "support_ticket_created", "comment_created"
    title: str
    body: str
    link: str  # frontend route to navigate to on click

    read_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )