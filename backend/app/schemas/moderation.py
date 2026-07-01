from fastapi import Query
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.schemas.datetime_mixin import UTCDatetimeMixin


class FlagContentCreate(BaseModel):
    reason: str
    notes: Optional[str] = None


class ModerationActionCreate(BaseModel):
    action: str
    notes: Optional[str] = None


class ModerationQueueItemRead(UTCDatetimeMixin, BaseModel):
    id: int
    blog_id: int
    blog_name: str
    item_type: str
    content_id: int
    author: str
    content: str
    reason: str
    notes: Optional[str] = None
    status: str
    reported_by_id: Optional[int] = None
    created_at: datetime


class ModerationActionRead(UTCDatetimeMixin, BaseModel):
    id: int
    moderation_item_id: int
    actor_user_id: Optional[int] = None
    action: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModerationQueueQueryParams(BaseModel):
    skip: int = Query(default=0, ge=0)
    limit: int = Query(default=50, ge=1, le=100)
    status: str = Query(default="pending", description="Filter item status (pending, approved, rejected)")
    content_type: Optional[str] = Query(default=None, description="Filter by type (post, comment)")