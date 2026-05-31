from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    actor_user_id: Optional[int] = Field(default=None, index=True)
    actor_email: Optional[str] = Field(default=None, index=True)
    action: str = Field(index=True)
    resource_type: str = Field(index=True)
    resource_id: Optional[int] = Field(default=None, index=True)
    blog_id: Optional[int] = Field(default=None, index=True)
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
