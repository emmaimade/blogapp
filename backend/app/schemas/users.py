from fastapi import Query
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.schemas.datetime_mixin import UTCDatetimeMixin
from app.models.blog import BlogRole, OnboardingStatus, OnboardingStep, PostVisibility, SubscriptionPlan
from app.models.user import PlatformRole

class UserCreate(BaseModel):
    username: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    workspace_name: str | None = None
    workspace_slug: str | None = None

class MembershipBlogRead(UTCDatetimeMixin, BaseModel):
    id: int
    name: str
    slug: str
    subdomain: str
    custom_domain: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    owner_id: int
    onboarding_status: OnboardingStatus
    onboarding_step: OnboardingStep
    onboarding_completed_at: Optional[datetime] = None
    comments_enabled: bool = True
    default_post_visibility: PostVisibility = PostVisibility.PUBLIC

    model_config = {"from_attributes": True}

class PublicAuthorRead(BaseModel):
    """
    Safe-for-anonymous-visitor author identity — used wherever a user is
    embedded in a publicly-readable response (a post's author, a comment's
    poster). No email, role, or account-status fields, unlike UserRead.
    """
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    model_config = {"from_attributes": True}


class UserBlogMembershipRead(UTCDatetimeMixin, BaseModel):
    id: int
    user_id: int
    blog_id: int
    role: BlogRole
    invited_at: datetime
    blog: MembershipBlogRead
    # The workspace's effective plan — filled in only on memberships the user
    # owns (see build_user_payload); billing isn't an editor's or author's business.
    plan: Optional[SubscriptionPlan] = None

    model_config = {"from_attributes": True}

class UserRead(UTCDatetimeMixin, BaseModel):
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: EmailStr
    platform_role: PlatformRole
    is_super_admin: bool
    is_active: bool
    email_verified: bool
    must_change_password: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    blog_memberships: list[UserBlogMembershipRead] = []

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

    model_config = {"from_attributes": True}


class SuperadminUserQueryParams(BaseModel):
    skip: int = Query(default=0, ge=0)
    limit: int = Query(default=100, ge=1, le=500)
    platform_role: Optional[PlatformRole] = Query(default=None, description="Filter by platform role")
    include_deleted: bool = Query(default=False, description="Whether to include soft-deleted accounts")
    search: Optional[str] = Query(default=None, description="Search term for username or email fields")