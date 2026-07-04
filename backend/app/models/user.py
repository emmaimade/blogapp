from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PlatformRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    USER = "user"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str = Field(default=None, nullable=True)
    last_name: str = Field(default=None, nullable=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    
    platform_role: PlatformRole = Field(default=PlatformRole.USER)
    is_super_admin: bool = Field(default=False)
    is_active: bool = Field(default=True)
    email_verified: bool = Field(default=False, nullable=False)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    
    created_at: datetime = Field(default_factory=utcnow)
    last_login: Optional[datetime] = Field(default=None, nullable=True)
    
    owned_blogs: List["Blog"] = Relationship(back_populates="owner", cascade_delete=True)
    blog_memberships: List["BlogMember"] = Relationship(back_populates="user")
    posts: List["Post"] = Relationship(back_populates="author")
    comments: List["Comment"] = Relationship(back_populates="user")
