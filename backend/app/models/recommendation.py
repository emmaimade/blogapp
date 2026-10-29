"""
Blogs an owner recommends to their readers: shown after a reader confirms a
follow (to follow in one tap) and as "Recommended reads" on the blog.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime as SQLDateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BlogRecommendation(SQLModel, table=True):
    __tablename__ = "blog_recommendations"
    __table_args__ = (
        UniqueConstraint("blog_id", "recommended_blog_id", name="uq_blog_recommendations_pair"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    recommended_blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    position: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )
