from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.blog import BlogRole, OnboardingStatus, OnboardingStep
from app.models.user import PlatformRole

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    workspace_name: str | None = None
    workspace_slug: str | None = None

class MembershipBlogRead(BaseModel):
    id: int
    name: str
    slug: str
    subdomain: str
    custom_domain: Optional[str] = None
    is_active: bool
    owner_id: int
    onboarding_status: OnboardingStatus
    onboarding_step: OnboardingStep
    onboarding_completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserBlogMembershipRead(BaseModel):
    id: int
    user_id: int
    blog_id: int
    role: BlogRole
    invited_at: datetime
    blog: MembershipBlogRead

    class Config:
        from_attributes = True

class UserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    platform_role: PlatformRole
    is_super_admin: bool
    is_active: bool
    created_at: datetime
    blog_memberships: list[UserBlogMembershipRead] = []

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

    class Config:
        from_attributes = True
