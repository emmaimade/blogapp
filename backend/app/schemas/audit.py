from fastapi import Query
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.schemas.datetime_mixin import UTCDatetimeMixin

class AuditLogRead(UTCDatetimeMixin, BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    actor_email: Optional[str] = None
    actor: Optional[str] = None
    action: str
    resource_type: str
    target_type: Optional[str] = None
    resource_id: Optional[int] = None
    blog_id: Optional[int] = None
    details: Optional[dict] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogQueryParams(BaseModel):
    skip: int = Query(default=0, ge=0, description="Pagination skip offset")
    limit: int = Query(default=50, ge=1, le=200, description="Max entries to return")
    action: Optional[str] = Query(default=None, description="Filter by action name")
    resource_type: Optional[str] = Query(default=None, description="Filter by resource type")
    actor_user_id: Optional[int] = Query(default=None, description="Filter by actor user ID")