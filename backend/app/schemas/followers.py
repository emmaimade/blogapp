from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.follower import FollowerStatus
from app.schemas.datetime_mixin import UTCDatetimeMixin


class FollowCreate(BaseModel):
    email: EmailStr
    source_post_id: Optional[int] = None
    # Honeypot: hidden from people by the follow form, so only bots fill it.
    website: Optional[str] = None


class FollowTokenPayload(BaseModel):
    token: str = Field(min_length=1, max_length=200)


class FollowAccepted(BaseModel):
    message: str


class FollowResult(BaseModel):
    """What the confirm/unsubscribe pages show: which blog it was about."""
    blog_name: str


# ── Studio (Audience page) ───────────────────────────────────────────────────

class FollowerSourcePost(BaseModel):
    id: int
    title: str
    slug: str


class FollowerRead(UTCDatetimeMixin, BaseModel):
    id: int
    email: str
    status: FollowerStatus
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    unsubscribed_at: Optional[datetime] = None
    source_post: Optional[FollowerSourcePost] = None


class FollowerSummary(BaseModel):
    active: int
    pending: int
    unsubscribed: int
    # The plan's cap on active followers; None when unlimited.
    max_followers: Optional[int] = None
    followers_enabled: bool
    # Whether the signed-in member may download the CSV export.
    can_export: bool


class FollowersSettingsUpdate(BaseModel):
    followers_enabled: bool
