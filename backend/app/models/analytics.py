"""
Daily traffic counters behind a workspace's view stats.

One row per post per day (views) and one per blog per day (visitors), bumped
by an upsert on every counted view rather than one row per view, so a busy
blog stays a few hundred rows a year. Days are UTC dates.

Post.views stays as the lifetime total; these tables add the history it
can't answer ("this month", "this week").
"""
from datetime import date
from typing import Optional

from sqlalchemy import Column, Date, UniqueConstraint
from sqlmodel import Field, SQLModel


class PostViewDaily(SQLModel, table=True):
    __tablename__ = "post_view_daily"
    __table_args__ = (
        UniqueConstraint("post_id", "day", name="uq_post_view_daily_post_day"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    post_id: int = Field(foreign_key="post.id", index=True, ondelete="CASCADE")
    day: date = Field(sa_column=Column(Date, nullable=False, index=True))
    views: int = Field(default=0)


class BlogVisitorDaily(SQLModel, table=True):
    """
    Readers per blog per day. Approximate: the blog frontend marks the first
    view of the day from each browser as a new visitor, so a reader on two
    devices counts twice and one who clears storage counts again.
    """
    __tablename__ = "blog_visitor_daily"
    __table_args__ = (
        UniqueConstraint("blog_id", "day", name="uq_blog_visitor_daily_blog_day"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    day: date = Field(sa_column=Column(Date, nullable=False))
    visitors: int = Field(default=0)
