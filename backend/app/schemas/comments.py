from datetime import datetime
from typing import Annotated, List, Optional
from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.schemas.datetime_mixin import UTCDatetimeMixin
from .users import PublicAuthorRead


class CommentRead(UTCDatetimeMixin, BaseModel):
    id: int
    content: str
    user_id: int
    post_id: int
    parent_id: Optional[int]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    user: PublicAuthorRead
    replies: List["CommentRead"] = Field(default_factory=list)

    @field_validator("replies", mode="before")
    @classmethod
    def ensure_replies_list(cls, v):
        return v if isinstance(v, list) else []

    model_config = {"from_attributes": True}


class CommentAdminRead(CommentRead):
    post: "PostShort"


MAX_COMMENT_LENGTH = 5000

# Surrounding whitespace is stripped before the length check, so a comment of
# only spaces/newlines is rejected as empty rather than stored.
CommentContent = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_COMMENT_LENGTH)
]


class CommentCreate(BaseModel):
    content: CommentContent
    post_id: int
    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    content: CommentContent
