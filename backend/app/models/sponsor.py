"""
Sponsors a blog's owner runs on their blog (Pro and Team plans), and the
daily impressions and clicks they report back to the sponsor.
"""
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Date, DateTime as SQLDateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SponsorPlacement(str, Enum):
    POST_END = "post_end"  # after a post's article, above the follow form
    HOME = "home"          # a banner on the blog's home page
    SIDEBAR = "sidebar"    # sticky in a post's right-hand column; under the title on phones


class Sponsor(SQLModel, table=True):
    __tablename__ = "sponsors"

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    name: str = Field(max_length=80)
    logo_url: Optional[str] = None
    tagline: str = Field(default="", max_length=120)
    url: str = Field(max_length=2000)
    placement: SponsorPlacement
    # Inclusive UTC dates; either may be open-ended.
    starts_on: Optional[date] = Field(default=None, sa_column=Column(Date, nullable=True))
    ends_on: Optional[date] = Field(default=None, sa_column=Column(Date, nullable=True))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )


class SponsorDaily(SQLModel, table=True):
    __tablename__ = "sponsor_daily"
    __table_args__ = (
        UniqueConstraint("sponsor_id", "day", name="uq_sponsor_daily_sponsor_day"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    sponsor_id: int = Field(foreign_key="sponsors.id", index=True, ondelete="CASCADE")
    day: date = Field(sa_column=Column(Date, nullable=False))
    impressions: int = Field(default=0)
    clicks: int = Field(default=0)


class AdvertiseEnquiry(SQLModel, table=True):
    """
    An enquiry from the blog's "Advertise with us" page. Emailed to the owner;
    kept so the hourly limit can count them (and for a future enquiries list).
    """
    __tablename__ = "advertise_enquiries"

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    name: str = Field(max_length=100)
    email: str = Field(max_length=320)
    company: str = Field(default="", max_length=120)
    budget: str = Field(default="", max_length=60)
    message: str
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )
