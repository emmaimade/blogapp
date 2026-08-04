from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, DateTime as SQLDateTime
from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SupportTicket(SQLModel, table=True):
    __tablename__ = "support_tickets"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    blog_id: Optional[int] = Field(default=None, foreign_key="blog.id", ondelete="SET NULL", index=True)
    subject: str
    status: TicketStatus = Field(default=TicketStatus.OPEN, index=True)
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, onupdate=utcnow),
    )

    messages: List["SupportMessage"] = Relationship(back_populates="ticket", cascade_delete=True)


class SupportMessage(SQLModel, table=True):
    __tablename__ = "support_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="support_tickets.id", ondelete="CASCADE", index=True)
    sender_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    body: str
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))

    ticket: SupportTicket = Relationship(back_populates="messages")