from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.blog import (
    BlogRole,
    OnboardingStatus,
    OnboardingStep,
    PostVisibility,
    SubscriptionPlan,
    TeamSize,
    WorkspaceOwnerRole,
    WorkspaceType,
)
from app.schemas.datetime_mixin import UTCDatetimeMixin
from .users import UserRead

class BlogCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    subdomain: Optional[str] = None
    description: Optional[str] = None

class BlogRead(UTCDatetimeMixin, BaseModel):
    id: int
    name: str
    slug: str
    subdomain: str
    custom_domain: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    owner_id: int
    onboarding_status: OnboardingStatus
    onboarding_step: OnboardingStep
    onboarding_completed_at: Optional[datetime] = None
    owner_role: Optional[WorkspaceOwnerRole] = None
    workspace_type: Optional[WorkspaceType] = None
    team_size: Optional[TeamSize] = None
    category: Optional[str] = None
    primary_language: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    default_post_visibility: PostVisibility
    comments_enabled: bool
    posts_per_page: int
    timezone: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BlogWithOwner(BlogRead):
    owner: UserRead

class BlogUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    custom_domain: Optional[str] = None

class BlogMemberCreate(BaseModel):
    email: EmailStr
    role: BlogRole = BlogRole.AUTHOR

class BlogMemberRead(UTCDatetimeMixin, BaseModel):
    id: int
    user_id: int
    blog_id: int
    role: BlogRole
    invited_at: datetime
    user: UserRead

    class Config:
        from_attributes = True

class BlogMemberUpdate(BaseModel):
    role: BlogRole

class BlogInvitationCreate(BaseModel):
    role: BlogRole = BlogRole.AUTHOR

class BlogInvitationRead(UTCDatetimeMixin, BaseModel):
    id: int
    blog_id: int
    role: BlogRole
    token: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BlogInvitationInfo(BaseModel):
    """Public info shown to an invitee before they accept"""
    blog_name: str
    blog_slug: str
    role: BlogRole
    expires_at: datetime
    already_accepted: bool

class DashboardRecentActivity(UTCDatetimeMixin, BaseModel):
    type: str
    title: str
    description: str
    time: datetime

class BlogDashboardSummary(BaseModel):
    blog_id: int
    blog_name: str
    role: BlogRole
    posts: int
    published_posts: int
    draft_posts: int
    scheduled_posts: int = 0
    comments: int
    tags: int
    team_members: int
    total_views: int
    recent_activity: List[DashboardRecentActivity] = []

class PlatformStats(BaseModel):
    total_blogs: int
    active_blogs: int
    total_users: int
    total_posts: int
    total_views: int
    blogs_created_today: int
    users_signed_up_today: int

class BlogAnalytics(UTCDatetimeMixin, BaseModel):
    blog_id: int
    blog_name: str
    owner_email: str
    total_posts: int
    total_views: int
    team_members: int
    created_at: datetime
    last_activity: Optional[datetime] = None

class SubscriptionRead(UTCDatetimeMixin, BaseModel):
    blog_id: int
    plan: SubscriptionPlan
    status: str
    trial_ends_at: Optional[datetime] = None
    current_period_ends_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OnboardingChecklist(BaseModel):
    about: bool
    profile: bool
    publication: bool
    team: bool
    plan: bool


class OnboardingSummary(UTCDatetimeMixin, BaseModel):
    status: OnboardingStatus
    current_step: OnboardingStep
    completed_steps: int
    total_steps: int = 5
    percent_complete: int
    checklist: OnboardingChecklist
    completed_at: Optional[datetime] = None


class OnboardingAboutUpdate(BaseModel):
    owner_role: WorkspaceOwnerRole
    workspace_type: WorkspaceType
    team_size: TeamSize


class OnboardingProfileUpdate(BaseModel):
    name: str
    tagline: str
    description: str
    category: str
    primary_language: str
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None


class OnboardingPublicationUpdate(BaseModel):
    default_post_visibility: PostVisibility
    comments_enabled: bool
    posts_per_page: int
    timezone: str


class OnboardingPlanUpdate(BaseModel):
    plan: SubscriptionPlan


class OnboardingTeamComplete(BaseModel):
    skipped: bool = False


class OnboardingState(BaseModel):
    blog: BlogRead
    subscription: Optional[SubscriptionRead] = None
    summary: OnboardingSummary
