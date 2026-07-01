from datetime import datetime
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field

from app.schemas.datetime_mixin import UTCDatetimeMixin
from .tags import TagRead
from .users import UserRead


class PostStatus(str, Enum):
    DRAFT     = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"


class MetadataRead(BaseModel):
    repo_url: Optional[str] = None
    live_url: Optional[str] = None
    class Config:
        from_attributes = True


class PostCreate(UTCDatetimeMixin, BaseModel):
    title: str
    slug: Optional[str] = None
    content: str
    thumbnail_url: Optional[str] = None
    is_project: bool = False
    published: bool = True                        
    status: PostStatus = PostStatus.DRAFT         
    published_at: Optional[datetime] = None       
    tag_ids: List[int] = Field(default_factory=list)


class PostUpdate(UTCDatetimeMixin, BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_project: Optional[bool] = None
    published: Optional[bool] = None             
    status: Optional[PostStatus] = None          
    published_at: Optional[datetime] = None      
    tag_ids: Optional[List[int]] = None


class PostRead(UTCDatetimeMixin, BaseModel):
    id: int
    title: str
    slug: str
    content: str
    blog_id: int
    author_id: Optional[int] = None
    author: Optional[UserRead] = None
    thumbnail_url: Optional[str] = None
    views: int
    is_project: bool
    is_sample: bool = False
    published: bool
    status: PostStatus
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    tags: List[TagRead] = Field(default_factory=list)
    project_metadata: Optional[MetadataRead] = None
    comments: List["CommentRead"] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PostShort(BaseModel):
    id: int
    title: str
    blog_id: int
    class Config:
        from_attributes = True