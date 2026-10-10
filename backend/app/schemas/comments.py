from datetime import datetime
from typing import Annotated, ClassVar, List, Optional
from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.models.comment import CommentDeletedBy
from app.schemas.datetime_mixin import UTCDatetimeMixin
from .pagination import PaginatedResponse
from .users import PublicAuthorRead


def deleted_comment_placeholder(deleted_by: Optional[str]) -> str:
    if deleted_by == CommentDeletedBy.AUTHOR:
        return "[This comment has been deleted by the author]"
    return "[This comment has been removed by a moderator]"


class _CommentFields(UTCDatetimeMixin, BaseModel):
    id: int
    content: str
    user_id: int
    post_id: int
    parent_id: Optional[int]
    is_deleted: bool
    deleted_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    edited_at: Optional[datetime] = None
    user: PublicAuthorRead

    # Deleted comments keep their original text in the database (for
    # moderators); every public shape replaces it with a placeholder.
    mask_deleted_content: ClassVar[bool] = True

    @model_validator(mode="after")
    def _mask_deleted_content(self):
        if self.is_deleted and self.mask_deleted_content:
            self.content = deleted_comment_placeholder(self.deleted_by)
        return self

    model_config = {"from_attributes": True}


class CommentReplyRead(_CommentFields):
    """A reply. Threads are one level deep, so replies carry no replies."""


class CommentRead(_CommentFields):
    replies: List[CommentReplyRead] = Field(default_factory=list)


class CommentThreadPage(PaginatedResponse[CommentRead]):
    """
    One page of a post's top-level comments. `total` counts top-level
    comments (what the pagination walks); `comment_count` counts every
    non-deleted comment including replies (what the heading shows).
    """
    comment_count: int


class CommentAdminRead(_CommentFields):
    """Workspace moderation view — shows a deleted comment's original text."""
    mask_deleted_content: ClassVar[bool] = False
    post: "PostShort"
    # People who've reported it in a still-pending moderation item.
    open_reports: int = 0
    # Whether this caller may restore it (see comments.service.can_restore).
    can_restore: bool = False


class CommentBanCreate(BaseModel):
    user_id: int
    reason: Optional[str] = Field(default=None, max_length=500)


class CommentBanRead(UTCDatetimeMixin, BaseModel):
    user_id: int
    user: PublicAuthorRead
    reason: Optional[str] = None
    banned_by_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


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
