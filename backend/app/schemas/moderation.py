from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FlagContentCreate(BaseModel):
    reason: str
    notes: Optional[str] = None


class ModerationActionCreate(BaseModel):
    action: str
    notes: Optional[str] = None


class ModerationQueueItemRead(BaseModel):
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


class ModerationActionRead(BaseModel):
    id: int
    moderation_item_id: int
    actor_user_id: Optional[int] = None
    action: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
