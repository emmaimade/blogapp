from typing import List, Optional
from sqlmodel import Session, select, Field, SQLModel, Relationship
from datetime import datetime, timezone
from enum import Enum
from slugify import slugify

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class BlogRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    AUTHOR = "author"


class OnboardingStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class OnboardingStep(str, Enum):
    ABOUT = "about"
    PROFILE = "profile"
    PUBLICATION = "publication"
    TEAM = "team"
    PLAN = "plan"


class WorkspaceOwnerRole(str, Enum):
    BLOGGER = "blogger"
    AGENCY = "agency"
    SAAS_COMPANY = "saas_company"
    CONTENT_TEAM = "content_team"


class WorkspaceType(str, Enum):
    PERSONAL_BLOG = "personal_blog"
    CLIENT_BLOGS = "client_blogs"
    COMPANY_BLOG = "company_blog"
    DEVELOPER_DOCS = "developer_docs"


class TeamSize(str, Enum):
    SOLO = "solo"
    SMALL = "small"
    GROWING = "growing"
    LARGE = "large"


class PostVisibility(str, Enum):
    PUBLIC = "public"
    MEMBERS_ONLY = "members_only"
    PAID_ONLY = "paid_only"

class BlogMember(SQLModel, table=True):
    __tablename__ = "blog_members"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    blog_id: int = Field(foreign_key="blog.id", ondelete="CASCADE")
    role: BlogRole = Field(default=BlogRole.AUTHOR)
    invited_at: datetime = Field(default_factory=utcnow)
    
    user: "User" = Relationship(back_populates="blog_memberships")
    blog: "Blog" = Relationship(back_populates="members")

class Blog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    subdomain: str = Field(unique=True, index=True)
    custom_domain: Optional[str] = Field(default=None)
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    owner_id: int = Field(
        foreign_key="user.id", 
        ondelete="CASCADE"      
    )
    onboarding_status: OnboardingStatus = Field(default=OnboardingStatus.NOT_STARTED)
    onboarding_step: OnboardingStep = Field(default=OnboardingStep.ABOUT)
    onboarding_completed_at: Optional[datetime] = None
    owner_role: Optional[WorkspaceOwnerRole] = None
    workspace_type: Optional[WorkspaceType] = None
    team_size: Optional[TeamSize] = None
    category: Optional[str] = None
    primary_language: str = Field(default="en")
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    default_post_visibility: PostVisibility = Field(default=PostVisibility.PUBLIC)
    comments_enabled: bool = Field(default=True)
    posts_per_page: int = Field(default=10)
    timezone: str = Field(default="UTC")
    
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"onupdate": utcnow}
    )
    
    owner: "User" = Relationship(back_populates="owned_blogs")
    members: List[BlogMember] = Relationship(back_populates="blog")
    posts: List["Post"] = Relationship(back_populates="blog")
    tags: List["Tag"] = Relationship(back_populates="blog")
    settings: List["SiteSettings"] = Relationship(back_populates="blog")
    
    @staticmethod
    def generate_unique_slug(name: str, session: Session) -> str:
        base_slug = slugify(name)
        unique_slug = base_slug
        counter = 1
        while session.exec(select(Blog).where(Blog.slug == unique_slug)).first():
            unique_slug = f"{base_slug}-{counter}"
            counter += 1
        return unique_slug

class PlatformAnalytics(SQLModel, table=True):
    __tablename__ = "platform_analytics"
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime = Field(default_factory=datetime.utcnow, index=True)
    total_blogs: int = Field(default=0)
    active_blogs: int = Field(default=0)
    total_users: int = Field(default=0)
    total_posts: int = Field(default=0)
    total_views: int = Field(default=0)
    revenue: float = Field(default=0.0)

class SubscriptionPlan(str, Enum):
    FREE = "free"
    PRO = "pro"
    TEAM = "team"

class BlogSubscription(SQLModel, table=True):
    __tablename__ = "blog_subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", unique=True, ondelete="CASCADE")
    plan: SubscriptionPlan = Field(default=SubscriptionPlan.FREE)
    status: str = Field(default="active")
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    current_period_ends_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={"onupdate": utcnow}
    )

class BlogInvitation(SQLModel, table=True):
    __tablename__ = "blog_invitations"
    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    role: BlogRole = Field(default=BlogRole.AUTHOR)
    token: str = Field(unique=True, index=True)
    created_by: int = Field(foreign_key="user.id", ondelete="CASCADE")
    accepted_by: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")
    accepted_at: Optional[datetime] = None
    expires_at: datetime
    created_at: datetime = Field(default_factory=utcnow)
