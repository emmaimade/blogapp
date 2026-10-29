from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.follower import FollowerStatus
from app.models.post import FollowerEmailStatus
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


class RecommendedBlog(BaseModel):
    """Another Inko blog, as shown to readers."""
    id: int
    name: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    url: str


class FollowResult(BaseModel):
    """What the confirm/unsubscribe pages show: which blog it was about."""
    blog_name: str
    # On confirming: the blogs it recommends, to follow in one tap.
    recommendations: List[RecommendedBlog] = []


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


class PostFollowerEmailRead(UTCDatetimeMixin, BaseModel):
    """How emailing one post to the blog's followers is going, for its team."""
    status: FollowerEmailStatus
    notify_followers: bool
    queued_at: Optional[datetime] = None
    sent: int
    # Followers it's going to: active, and following since before it went live.
    recipients: int
    # False while FOLLOWER_EMAILS_ENABLED is off: queued, waiting.
    sending_enabled: bool


# ── Recommendations between blogs ────────────────────────────────────────────

class RecommendationFollowPayload(BaseModel):
    """Follow blogs from the confirm page; the confirm link's token proves the address."""
    token: str = Field(min_length=1, max_length=200)
    blog_ids: List[int] = Field(min_length=1, max_length=5)


class RecommendationFollowResult(BaseModel):
    followed: List[str]
    # Already following, or a blog that isn't taking followers right now.
    skipped: List[str]


class RecommendationsUpdate(BaseModel):
    """The blogs to recommend, in order. Replaces the whole list."""
    blog_ids: List[int] = Field(default_factory=list, max_length=5)


class StudioRecommendation(RecommendedBlog):
    # Active followers this recommendation sent that blog.
    followers_sent: int
    # False when it no longer qualifies (suspended, opted out...): hidden from readers.
    shown: bool


class ReceivedRecommendation(BaseModel):
    id: int
    name: str
    url: str
    # Active followers that blog's recommendation sent you.
    followers: int
    recommends_you_now: bool


class RecommendationsOverview(BaseModel):
    recommendations: List[StudioRecommendation]
    received: List[ReceivedRecommendation]
    allow_recommendations: bool


class RecommendationSettings(BaseModel):
    allow_recommendations: bool
