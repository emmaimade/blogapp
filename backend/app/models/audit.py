from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    actor_user_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id", ondelete="SET NULL")
    actor_email: Optional[str] = Field(default=None, index=True)
    action: str = Field(index=True)
    resource_type: str = Field(index=True)
    resource_id: Optional[int] = Field(default=None, index=True)
    blog_id: Optional[int] = Field(default=None, index=True, foreign_key="blog.id", ondelete="CASCADE")
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow, index=True)
