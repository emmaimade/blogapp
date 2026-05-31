from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogRead(BaseModel):
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
