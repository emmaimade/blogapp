from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .users import UserRead


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
    replies: List["CommentRead"] = Field(default_factory=list)

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
