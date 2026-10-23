from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.datetime_mixin import UTCDatetimeMixin

StatsRange = Literal["7d", "30d", "90d", "12m"]


class PostViewCreate(BaseModel):
    # True on a browser's first view of this blog today — feeds the
    # approximate daily visitor count.
    new_visitor: bool = False
    # document.referrer, sent with the first view of a visit only ("" when
    # there was none). Classified to a source name; the URL isn't kept.
    referrer: Optional[str] = Field(default=None, max_length=2000)


class AnalyticsDay(BaseModel):
    day: date
    views: int
    # None for authors: visitors are blog-wide, not per post.
    visitors: Optional[int] = None


class AnalyticsTopPost(BaseModel):
    id: int
    title: str
    slug: str
    views: int


class BlogAnalyticsRead(BaseModel):
    range: StatsRange
    days: List[AnalyticsDay]
    total_views: int
    total_visitors: Optional[int] = None
    top_posts: List[AnalyticsTopPost]
    # How far back the workspace's plan lets it look; None for superadmins.
    history_days: Optional[int] = None


# ── The studio's Analytics page ──────────────────────────────────────────────

AnalyticsPostSort = Literal["views", "followers", "newest"]


class AnalyticsTotals(BaseModel):
    views: int
    visitors: int
    new_followers: int
    unsubscribes: int


class AnalyticsOverviewDay(BaseModel):
    day: date
    views: int
    visitors: int
    new_followers: int
    unsubscribes: int


class AnalyticsSource(BaseModel):
    source: str
    visits: int


class AnalyticsFollowerPost(BaseModel):
    id: int
    title: str
    slug: str
    followers: int


class AnalyticsOverviewRead(BaseModel):
    range: StatsRange
    days: List[AnalyticsOverviewDay]
    totals: AnalyticsTotals
    # The same length of time just before the range; None when that reaches
    # further back than the plan's history.
    previous_totals: Optional[AnalyticsTotals] = None
    sources: List[AnalyticsSource]
    follower_posts: List[AnalyticsFollowerPost]
    history_days: Optional[int] = None
    can_export: bool


class AnalyticsPostRow(UTCDatetimeMixin, BaseModel):
    id: int
    title: str
    slug: str
    published_at: Optional[datetime] = None
    views_in_range: int
    lifetime_views: int
    followers_gained: int
