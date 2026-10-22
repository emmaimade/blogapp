"""
Readers who follow a blog by email. No account: an address, double opt-in
(pending until the emailed link is confirmed), and a way back out.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime as SQLDateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FollowerStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    UNSUBSCRIBED = "unsubscribed"


class BlogFollower(SQLModel, table=True):
    __tablename__ = "blog_followers"
    __table_args__ = (
        UniqueConstraint("blog_id", "email", name="uq_blog_followers_blog_email"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    # Stored lowercased, so one address is one follower however it's typed.
    email: str
    status: FollowerStatus = Field(default=FollowerStatus.PENDING)

    # The emailed confirmation link: only its hash is kept. Kept after
    # confirming, so a second click on the same link still says "you're in".
    confirm_token_hash: Optional[str] = Field(default=None, index=True)
    confirm_sent_at: Optional[datetime] = Field(
        default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True),
    )
    # Confirmation emails sent in the 24 hours since the first of them —
    # caps how often one address can be emailed from the follow form.
    confirm_send_count: int = Field(default=0)

    # The post they followed from, for "which posts bring followers in".
    source_post_id: Optional[int] = Field(default=None, foreign_key="post.id", ondelete="SET NULL")

    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )
    confirmed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True),
    )
    unsubscribed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True),
    )
