from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None # Will be hashed separately

    class Config:
        from_attributes = True

# Tag Schemas
class TagRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class TagUpdate(BaseModel):
    name: Optional[str] = None

    class Config:
        from_attributes = True

class MetadataRead(BaseModel):
    repo_url: Optional[str] = None
    live_url: Optional[str] = None

    class Config:
        from_attributes = True

# Comment Schemas
class CommentRead(BaseModel):
    id: int
    content: str
    user_id: int
    post_id: int
    parent_id: Optional[int]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    user: UserRead
    replies: List["CommentRead"] = []
    
    @field_validator("replies", mode="before")
    @classmethod
    def ensure_replies_list(cls, v):
        return v if isinstance(v, list) else []

    model_config = {"from_attributes": True}

class CommentAdminRead(CommentRead):
    post: "PostShort"  

class CommentCreate(BaseModel):
    content: str
    post_id: int
    parent_id: Optional[int] = None


# Post Schemas
class PostCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    content: str
    thumbnail_url: Optional[str] = None
    is_project: bool = False
    published: bool = True
    tag_ids: List[int] = []

class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_project: Optional[bool] = None
    published: Optional[bool] = None
    tag_ids: Optional[List[int]] = None

class PostRead(BaseModel):
    id: int
    title: str
    slug: str
    content: str
    thumbnail_url: Optional[str] = None
    is_project: bool
    published: bool
    created_at: datetime
    updated_at: datetime

    # Relationships
    tags: List[TagRead] = []
    project_metadata: Optional[MetadataRead] = None

    comments: List[CommentRead] = []

    class Config:
        from_attributes = True

class PostShort(BaseModel):
    id: int
    title: str
    class Config:
        from_attributes = True


# Rebuild Schemas to resolve forward references
CommentRead.model_rebuild()
PostRead.model_rebuild()