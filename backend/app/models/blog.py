from typing import List, Optional
from sqlalchemy import Column, DateTime as SQLDateTime
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
    invited_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )

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
    onboarding_completed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(SQLDateTime(timezone=True), nullable=True),
    )
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

    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, onupdate=utcnow),
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
    date: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, index=True),
    )
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


class BillingInterval(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"


class BlogSubscription(SQLModel, table=True):
    __tablename__ = "blog_subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", unique=True, ondelete="CASCADE")
    plan: SubscriptionPlan = Field(default=SubscriptionPlan.FREE)
    # Stored as plain strings (values of SubscriptionStatus / BillingInterval)
    # so new states don't need a Postgres enum migration.
    status: str = Field(default=SubscriptionStatus.ACTIVE.value)
    billing_interval: Optional[str] = None
    paystack_customer_code: Optional[str] = None
    paystack_subscription_code: Optional[str] = None
    # Paystack needs this alongside the subscription code to disable a
    # subscription; it only arrives on the subscription.create event.
    paystack_email_token: Optional[str] = None
    last_payment_reference: Optional[str] = None
    # The card Paystack can charge again without the owner present, and the
    # email it belongs to — needed for prorated upgrades and for creating the
    # replacement subscription on a plan change.
    paystack_authorization_code: Optional[str] = None
    paystack_customer_email: Optional[str] = None
    # A downgrade waits for the end of the paid period: the plan stays as it
    # is until pending_change_at, then becomes pending_plan.
    pending_plan: Optional[str] = None
    pending_interval: Optional[str] = None
    pending_change_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    # When the current paid period began — the basis for prorating an upgrade.
    current_period_started_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    # One trial per workspace — stays true after the trial ends.
    trial_used: bool = Field(default=False)
    trial_ends_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    current_period_ends_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    cancelled_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False, onupdate=utcnow),
    )


class PaymentTransaction(SQLModel, table=True):
    """One Paystack charge against a workspace — the billing history."""
    __tablename__ = "payment_transactions"
    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    reference: str = Field(unique=True, index=True)
    # Paystack amounts are in the currency's subunit (kobo for NGN).
    amount_kobo: int
    currency: str = Field(default="NGN")
    plan: str
    billing_interval: Optional[str] = None
    status: str
    paid_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )


class PaymentEvent(SQLModel, table=True):
    """
    Every Paystack webhook we've acted on. Paystack retries deliveries, so
    `event_key` (event type + the payload's own identifier) being unique is
    what stops one payment from being applied twice.
    """
    __tablename__ = "payment_events"
    id: Optional[int] = Field(default=None, primary_key=True)
    event_key: str = Field(unique=True, index=True)
    event_type: str = Field(index=True)
    blog_id: Optional[int] = Field(default=None, index=True, foreign_key="blog.id", ondelete="SET NULL")
    payload: str
    processed_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(SQLDateTime(timezone=True), nullable=False),
    )


class BlogInvitation(SQLModel, table=True):
    __tablename__ = "blog_invitations"
    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id", index=True, ondelete="CASCADE")
    email: str = Field(index=True)
    role: BlogRole = Field(default=BlogRole.AUTHOR)
    token: str = Field(unique=True, index=True)
    created_by: int = Field(foreign_key="user.id", ondelete="CASCADE")
    accepted_by: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")
    accepted_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    expires_at: datetime = Field(sa_column=Column(SQLDateTime(timezone=True), nullable=False))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))