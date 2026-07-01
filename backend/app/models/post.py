from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from slugify import slugify
from sqlmodel import Field, Relationship, SQLModel, Session, select

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PostStatus(str, Enum):
    DRAFT     = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"


class PostTagLink(SQLModel, table=True):
    post_id: Optional[int] = Field(default=None, foreign_key="post.id", primary_key=True)
    tag_id:  Optional[int] = Field(default=None, foreign_key="tag.id",  primary_key=True)


class Tag(SQLModel, table=True):
    id:      Optional[int] = Field(default=None, primary_key=True)
    name:    str            = Field(index=True)
    blog_id: int            = Field(foreign_key="blog.id")

    blog:  "Blog"       = Relationship(back_populates="tags")
    posts: List["Post"] = Relationship(back_populates="tags", link_model=PostTagLink)


class ProjectMetadata(SQLModel, table=True):
    id:       Optional[int] = Field(default=None, primary_key=True)
    repo_url: Optional[str] = None
    live_url: Optional[str] = None
    post_id:  int           = Field(foreign_key="post.id")
    post:     "Post"        = Relationship(back_populates="project_metadata")


class Post(SQLModel, table=True):
    id:            Optional[int] = Field(default=None, primary_key=True)
    title:         str
    slug:          str            = Field(index=True)
    content:       str
    author_id:     Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")
    thumbnail_url: Optional[str] = Field(default=None)
    views:         int            = Field(default=0)
    is_project:    bool           = Field(default=False)
    is_sample:     bool           = Field(default=False, nullable=False)

    status:       PostStatus      = Field(default=PostStatus.DRAFT)
    published:    bool            = Field(default=False)
    published_at: Optional[datetime] = Field(
        default=None,
        index=True,
        description="UTC datetime when post goes/went live.",
    )

    blog_id: int = Field(foreign_key="blog.id", ondelete="CASCADE")

    blog:             "Blog"                = Relationship(back_populates="posts")
    author:           Optional["User"]      = Relationship(back_populates="posts")
    comments:         List["Comment"]       = Relationship(back_populates="post")
    tags:             List[Tag]             = Relationship(back_populates="posts", link_model=PostTagLink)
    project_metadata: Optional[ProjectMetadata] = Relationship(back_populates="post")

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"onupdate": utcnow},
    )

    @staticmethod
    def generate_unique_slug(title: str, blog_id: int, session: Session) -> str:
        base_slug = slugify(title)
        unique_slug = base_slug
        counter = 1
        while session.exec(
            select(Post).where(Post.slug == unique_slug, Post.blog_id == blog_id)
        ).first():
            unique_slug = f"{base_slug}-{counter}"
            counter += 1
        return unique_slug