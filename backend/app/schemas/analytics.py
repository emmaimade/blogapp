from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel

StatsRange = Literal["7d", "30d", "90d", "12m"]


class PostViewCreate(BaseModel):
    # True on a browser's first view of this blog today — feeds the
    # approximate daily visitor count.
    new_visitor: bool = False


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
