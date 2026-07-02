import json
from pathlib import Path
from jinja2 import Template
from typing import List
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select
from app.models.post import PostStatus
from app.modules.posts.service import upload_welcome_banner
from datetime import datetime, timezone

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.permissions import (
    Permissions,
    get_current_blog,
    get_public_blog,
    get_user_blogs,
    require_blog_owner,
    require_completed_onboarding,
)
from app.core.security import get_current_user
from app.models import (
    Blog,
    BlogInvitation,
    BlogMember,
    BlogRole,
    BlogSubscription,
    Comment,
    OnboardingStatus,
    OnboardingStep,
    Post,
    SiteSettings,
    SubscriptionPlan,
    Tag,
    User,
)
from app.schemas import (
    AboutPageSettings,
    BlogCreate,
    BlogDashboardSummary,
    BlogInvitationCreate,
    BlogInvitationInfo,
    BlogInvitationRead,
    BlogMemberCreate,
    BlogMemberRead,
    BlogMemberUpdate,
    BlogRead,
    BlogUpdate,
    BrandingSettings,
    ContactSettings,
    DashboardRecentActivity,
    FooterSettings,
    GeneralSettings,
    OnboardingAboutUpdate,
    OnboardingPlanUpdate,
    OnboardingProfileUpdate,
    OnboardingPublicationUpdate,
    OnboardingState,
    OnboardingSummary,
    OnboardingTeamComplete,
    SEOSettings,
    SubscriptionRead,
)

router = APIRouter(prefix="/blogs", tags=["blogs"])
invitations_router = APIRouter(prefix="/invitations", tags=["invitations"])

INVITE_EXPIRY_DAYS = 7

# HELPER FUNCTIONS
def _render_welcome_template(context: dict) -> str:
    template_path = Path(__file__).parent / "welcome-template.md"

    template_content = template_path.read_text(
        encoding="utf-8"
    )

    return Template(template_content).render(**context)


# END

def _set_site_setting(session: Session, blog_id: int, key: str, payload: dict) -> None:
    setting = session.exec(
        select(SiteSettings).where(SiteSettings.blog_id == blog_id, SiteSettings.setting_key == key)
    ).first()
    value = json.dumps(payload)
    if setting:
        setting.setting_value = value
        setting.updated_at = datetime.now(timezone.utc)
        session.add(setting)
        return

    session.add(
        SiteSettings(
            blog_id=blog_id,
            setting_key=key,
            setting_value=value,
            updated_at=datetime.now(timezone.utc),
        )
    )


def _step_completion(session: Session, blog: Blog, subscription: BlogSubscription | None, member_count: int) -> dict[str, bool]:
    publication_setting = session.exec(
        select(SiteSettings).where(SiteSettings.blog_id == blog.id, SiteSettings.setting_key == "publication")
    ).first()
    return {
        "about": bool(blog.owner_role and blog.workspace_type and blog.team_size),
        "profile": bool(
            blog.name.strip()
            and (blog.tagline or "").strip()
            and (blog.category or "").strip()
            and (blog.primary_language or "").strip()
        ),
        "publication": publication_setting is not None,
        "team": member_count > 1,
        "plan": blog.onboarding_status == OnboardingStatus.COMPLETED,
    }


def _build_onboarding_summary(session: Session, blog: Blog, subscription: BlogSubscription | None, member_count: int, team_skipped: bool = False) -> OnboardingSummary:
    checklist = _step_completion(session, blog, subscription, member_count)
    checklist["team"] = checklist["team"] or team_skipped
    if blog.onboarding_status == OnboardingStatus.COMPLETED:
        checklist = {key: True for key in checklist}
    completed_steps = sum(1 for done in checklist.values() if done)
    percent_complete = int((completed_steps / 5) * 100)
    status = blog.onboarding_status

    if completed_steps == 5 and status != OnboardingStatus.COMPLETED:
        status = OnboardingStatus.COMPLETED
    elif completed_steps > 0 and status == OnboardingStatus.NOT_STARTED:
        status = OnboardingStatus.IN_PROGRESS

    return OnboardingSummary(
        status=status,
        current_step=blog.onboarding_step,
        completed_steps=completed_steps,
        percent_complete=percent_complete,
        completed_at=blog.onboarding_completed_at,
        checklist=checklist,
    )


def _load_subscription(session: Session, blog_id: int) -> BlogSubscription | None:
    return session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()


def _load_team_step_skipped(session: Session, blog_id: int) -> bool:
    setting = session.exec(
        select(SiteSettings).where(SiteSettings.blog_id == blog_id, SiteSettings.setting_key == "onboarding_meta")
    ).first()
    if not setting:
        return False
    try:
        payload = json.loads(setting.setting_value)
    except (TypeError, json.JSONDecodeError):
        return False
    return bool(payload.get("team_skipped"))


def _save_team_step_skipped(session: Session, blog_id: int, skipped: bool) -> None:
    _set_site_setting(session, blog_id, "onboarding_meta", {"team_skipped": skipped})


def _sync_onboarding_state(session: Session, blog: Blog) -> tuple[OnboardingSummary, BlogSubscription | None]:
    subscription = _load_subscription(session, blog.id)
    member_count = session.exec(select(func.count(BlogMember.id)).where(BlogMember.blog_id == blog.id)).first() or 0
    team_skipped = _load_team_step_skipped(session, blog.id)
    summary = _build_onboarding_summary(session, blog, subscription, member_count, team_skipped=team_skipped)

    blog.onboarding_status = summary.status

    if summary.checklist.plan and summary.status == OnboardingStatus.COMPLETED:
        blog.onboarding_step = OnboardingStep.PLAN
        blog.onboarding_completed_at = blog.onboarding_completed_at or datetime.now(timezone.utc)
    elif not summary.checklist.about:
        blog.onboarding_step = OnboardingStep.ABOUT
        blog.onboarding_completed_at = None
    elif not summary.checklist.profile:
        blog.onboarding_step = OnboardingStep.PROFILE
        blog.onboarding_completed_at = None
    elif not summary.checklist.publication:
        blog.onboarding_step = OnboardingStep.PUBLICATION
        blog.onboarding_completed_at = None
    elif not summary.checklist.team:
        blog.onboarding_step = OnboardingStep.TEAM
        blog.onboarding_completed_at = None
    elif not summary.checklist.plan:
        blog.onboarding_step = OnboardingStep.PLAN
        blog.onboarding_completed_at = None

    session.add(blog)
    return summary, subscription


def _initialize_blog_settings(session: Session, blog_id: int) -> None:
    """Initialize all default settings for a new blog on creation."""
    # Branding settings with default colors and fonts
    _set_site_setting(
        session,
        blog_id,
        "branding",
        BrandingSettings().model_dump(),
    )
    
    # General settings
    _set_site_setting(
        session,
        blog_id,
        "general",
        GeneralSettings().model_dump(),
    )
    
    # Footer settings
    _set_site_setting(
        session,
        blog_id,
        "footer",
        FooterSettings().model_dump(),
    )
    
    # SEO settings
    _set_site_setting(
        session,
        blog_id,
        "seo",
        SEOSettings().model_dump(),
    )
    
    # Contact settings
    _set_site_setting(
        session,
        blog_id,
        "contact",
        ContactSettings().model_dump(),
    )
    
    # About page settings
    _set_site_setting(
        session,
        blog_id,
        "about_page",
        AboutPageSettings().model_dump(),
    )
    
    session.commit()

def _create_welcome_post_on_onboarding_complete(
    session: Session, blog: Blog, current_user: User
) -> Post | None:
    """
    Create a personalised welcome post when onboarding completes.
    Idempotent — if an is_sample post already exists, skip creation.
    """
    # Idempotency check
    existing = session.exec(
        select(Post).where(
            Post.blog_id == blog.id,
            Post.is_sample == True,
        )
    ).first()
    if existing:
        return existing

    # Generate & upload banner
    banner_url = upload_welcome_banner(blog.name)

    # Template context
    workspace_type_map = {
        "personal_blog": "Personal Blog",
        "client_blogs": "Client Blogs",
        "company_blog": "Company Blog",
        "developer_docs": "Developer Docs",
    }

    context = {
        "blog_name": blog.name,
        "tagline": blog.tagline or "",
        "banner_url": banner_url,
        "description": blog.description or "",
        "category": blog.category or "",
        "primary_language": blog.primary_language or "en",
        "workspace_type": workspace_type_map.get(
            getattr(blog.workspace_type, 'value', blog.workspace_type) or "", ""
        ),
        "team_size": getattr(blog.team_size, 'value', blog.team_size) or "",
    }

    content = _render_welcome_template(context)

    welcome_slug = Post.generate_unique_slug(
        f"welcome-to-{blog.name}", blog.id, session
    )

    welcome_post = Post(
        title=f"Welcome to {blog.name}",
        slug=welcome_slug,
        content=content,
        author_id=current_user.id,
        blog_id=blog.id,
        status=PostStatus.DRAFT,
        published=False,
        published_at=None,
        is_project=False,
        is_sample=True,
        views=0,
        thumbnail_url=banner_url,
    )
    session.add(welcome_post)
    session.flush()

    add_audit_log(
        session,
        action="post.welcome_created",
        resource_type="post",
        resource_id=welcome_post.id,
        blog_id=blog.id,
        actor=current_user,
        details={
            "title": welcome_post.title,
            "source": "onboarding_complete",
        },
    )

    return welcome_post

@router.post("/", response_model=BlogRead)
def create_blog(
    blog_data: BlogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    new_blog = Blog(
        name=blog_data.name,
        slug=blog_data.slug,
        subdomain=blog_data.subdomain,
        description=blog_data.description,
        owner_id=current_user.id,
        onboarding_status=OnboardingStatus.IN_PROGRESS,
        onboarding_step=OnboardingStep.ABOUT,
    )
    session.add(new_blog)
    session.commit()
    session.refresh(new_blog)

    _initialize_blog_settings(session, new_blog.id)

    # Owner membership
    membership = BlogMember(
        user_id=current_user.id,
        blog_id=new_blog.id,
        role=BlogRole.OWNER,
        invited_at=datetime.now(timezone.utc),
    )
    session.add(membership)
    session.add(BlogSubscription(blog_id=new_blog.id))

    # Basic welcome post (will be updated at end of onboarding)
    welcome_post = Post(
        title="Welcome to your new Inko blog!",
        slug=Post.generate_unique_slug("welcome-to-inko", new_blog.id, session),
        content="""Welcome! This is a placeholder post. It will be replaced with a personalized welcome message once you complete onboarding.""",
        author_id=current_user.id,
        blog_id=new_blog.id,
        status=PostStatus.PUBLISHED,
        published=True,
        published_at=datetime.now(timezone.utc),
        is_sample=True,
        is_project=False,
    )
    session.add(welcome_post)

    add_audit_log(
        session,
        action="blog.create",
        resource_type="blog",
        resource_id=new_blog.id,
        blog_id=new_blog.id,
        actor=current_user,
        details={"name": new_blog.name},
    )
    session.commit()
    return new_blog


@router.get("/me", response_model=List[BlogRead])
def read_my_blogs(
    blogs: List[Blog] = Depends(get_user_blogs),
):
    return blogs


@router.get("/by-subdomain/{subdomain}", response_model=BlogRead)
def read_blog_by_subdomain(
    subdomain: str,
    session: Session = Depends(get_session),
):
    blog = session.exec(select(Blog).where(Blog.subdomain == subdomain)).first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    return blog

@router.get("/check-slug/{slug}")
def check_slug_availability(
    slug: str,
    session: Session = Depends(get_session),
):
    blog = session.exec(select(Blog).where(Blog.slug == slug)).first()
    return {"available": blog is None}

@router.get("/{blog_id}", response_model=BlogRead)
def read_blog(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
):
    return blog


@router.get("/{blog_id}/onboarding", response_model=OnboardingState)
def get_onboarding_state(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=SubscriptionRead.model_validate(subscription) if subscription else None,
        summary=summary,
    )


@router.put("/{blog_id}/onboarding/about", response_model=OnboardingState)
def update_onboarding_about(
    blog_id: int,
    payload: OnboardingAboutUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    blog.owner_role = payload.owner_role
    blog.workspace_type = payload.workspace_type
    blog.team_size = payload.team_size
    blog.onboarding_status = OnboardingStatus.IN_PROGRESS
    blog.onboarding_step = OnboardingStep.PROFILE
    session.add(blog)
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=SubscriptionRead.model_validate(subscription) if subscription else None,
        summary=summary,
    )


@router.put("/{blog_id}/onboarding/profile", response_model=OnboardingState)
def update_onboarding_profile(
    blog_id: int,
    payload: OnboardingProfileUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    blog.name = payload.name
    blog.tagline = payload.tagline
    blog.description = payload.description
    blog.category = payload.category
    blog.primary_language = payload.primary_language
    blog.logo_url = payload.logo_url
    blog.favicon_url = payload.favicon_url
    blog.onboarding_status = OnboardingStatus.IN_PROGRESS
    blog.onboarding_step = OnboardingStep.PUBLICATION
    session.add(blog)

    _set_site_setting(
        session,
        blog_id,
        "general",
        {
            "site_name": payload.name,
            "site_tagline": payload.tagline,
            "site_description": payload.description,
            "timezone": blog.timezone,
            "language": payload.primary_language,
            "posts_per_page": blog.posts_per_page,
        },
    )
    _set_site_setting(
        session,
        blog_id,
        "branding",
        {
            "primary_color": "#9333EA",
            "secondary_color": "#18181B",
            "accent_color": "#A855F7",
            "logo_url": payload.logo_url,
            "favicon_url": payload.favicon_url,
            "font_heading": "Inter",
            "font_body": "Inter",
        },
    )
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=SubscriptionRead.model_validate(subscription) if subscription else None,
        summary=summary,
    )


@router.put("/{blog_id}/onboarding/publication", response_model=OnboardingState)
def update_onboarding_publication(
    blog_id: int,
    payload: OnboardingPublicationUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    blog.default_post_visibility = payload.default_post_visibility
    blog.comments_enabled = payload.comments_enabled
    blog.posts_per_page = payload.posts_per_page
    blog.timezone = payload.timezone
    blog.onboarding_status = OnboardingStatus.IN_PROGRESS
    blog.onboarding_step = OnboardingStep.TEAM
    session.add(blog)

    _set_site_setting(
        session,
        blog_id,
        "general",
        {
            "site_name": blog.name,
            "site_tagline": blog.tagline or "Your ideas, amplified",
            "site_description": blog.description or "",
            "timezone": payload.timezone,
            "language": blog.primary_language,
            "posts_per_page": payload.posts_per_page,
        },
    )
    _set_site_setting(
        session,
        blog_id,
        "publication",
        {
            "default_post_visibility": payload.default_post_visibility,
            "comments_enabled": payload.comments_enabled,
            "posts_per_page": payload.posts_per_page,
            "timezone": payload.timezone,
        },
    )
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=SubscriptionRead.model_validate(subscription) if subscription else None,
        summary=summary,
    )


@router.post("/{blog_id}/onboarding/team/complete", response_model=OnboardingState)
def complete_onboarding_team_step(
    blog_id: int,
    payload: OnboardingTeamComplete,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    _save_team_step_skipped(session, blog_id, payload.skipped)
    blog.onboarding_status = OnboardingStatus.IN_PROGRESS
    blog.onboarding_step = OnboardingStep.PLAN
    session.add(blog)
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=SubscriptionRead.model_validate(subscription) if subscription else None,
        summary=summary,
    )


@router.put("/{blog_id}/onboarding/plan", response_model=OnboardingState)
def update_onboarding_plan(
    blog_id: int,
    payload: OnboardingPlanUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    # Update subscription
    subscription = _load_subscription(session, blog_id)
    if subscription:
        subscription.plan = payload.plan
        session.add(subscription)
    else:
        subscription = BlogSubscription(blog_id=blog_id, plan=payload.plan)
        session.add(subscription)

    # Complete onboarding
    blog.onboarding_status = OnboardingStatus.COMPLETED
    blog.onboarding_step = OnboardingStep.PLAN
    blog.onboarding_completed_at = datetime.now(timezone.utc)
    session.add(blog)

    summary, subscription = _sync_onboarding_state(session, blog)

    # Create personalized welcome post
    _create_welcome_post_on_onboarding_complete(session, blog, current_user)

    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=SubscriptionRead.model_validate(subscription) if subscription else None,
        summary=summary,
    )

@router.patch("/{blog_id}", response_model=BlogRead)
def update_blog(
    blog_id: int,
    blog_data: BlogUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    update_dict = blog_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(blog, key, value)

    session.add(blog)
    add_audit_log(
        session,
        action="blog.update",
        resource_type="blog",
        resource_id=blog.id,
        blog_id=blog.id,
        actor=current_user,
        details={"fields": sorted(update_dict.keys())},
    )
    session.commit()
    session.refresh(blog)
    return blog


@router.get("/{blog_id}/members", response_model=List[BlogMemberRead])
def read_blog_members(
    blog_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    statement = (
        select(BlogMember)
        .where(BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
        .order_by(BlogMember.invited_at.asc())
    )
    return session.exec(statement).all()


@router.post("/{blog_id}/members", response_model=BlogMemberRead, status_code=status.HTTP_201_CREATED)
def invite_blog_member(
    blog_id: int,
    payload: BlogMemberCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    # Find the user by email
    user_to_invite = session.exec(select(User).where(User.email == payload.email)).first()
    if not user_to_invite:
        raise HTTPException(status_code=404, detail="No user found with that email address")

    # Prevent duplicate membership
    existing = session.exec(
        select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == user_to_invite.id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This user is already a member of this blog")

    # Prevent inviting yourself
    if user_to_invite.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    membership = BlogMember(
        user_id=user_to_invite.id,
        blog_id=blog_id,
        role=payload.role,
        invited_at=datetime.now(timezone.utc),
    )
    session.add(membership)
    add_audit_log(
        session,
        action="blog.member_add",
        resource_type="blog_member",
        resource_id=user_to_invite.id,
        blog_id=blog_id,
        actor=current_user,
        details={"role": payload.role, "email": user_to_invite.email},
    )
    session.commit()

    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.user_id == user_to_invite.id, BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    return membership


@router.delete("/{blog_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_blog_member(
    blog_id: int,
    member_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    membership = session.exec(
        select(BlogMember).where(BlogMember.id == member_id, BlogMember.blog_id == blog_id)
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.role == BlogRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove the blog owner")
    if membership.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")

    add_audit_log(
        session,
        action="blog.member_remove",
        resource_type="blog_member",
        resource_id=membership.user_id,
        blog_id=blog_id,
        actor=current_user,
        details={"member_id": membership.id},
    )
    session.delete(membership)
    session.commit()


@router.patch("/{blog_id}/members/{member_id}", response_model=BlogMemberRead)
def update_blog_member_permissions(
    blog_id: int,
    member_id: int,
    payload: BlogMemberUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Allow access if the user is a global superadmin OR a verified workspace owner
    is_super_admin = current_user.is_super_admin or getattr(current_user, "platform_role", None) == "superadmin"
    
    if not is_super_admin:
        actor_membership = session.exec(
            select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == current_user.id)
        ).first()
        if not actor_membership or actor_membership.role != BlogRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only Blog Owners or Superadmins can modify workspace privileges."
            )

    # FETCH TARGET MEMBER RECORD
    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.id == member_id, BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Blog member not found")

    # EXTRACT UNSET/PASSED PARAMETERS
    update_data = payload.model_dump(exclude_unset=True)

    # Safety Rule: Prevent a lone workspace owner from accidentally demoting themselves
    if "role" in update_data and update_data["role"] != BlogRole.OWNER and membership.role == BlogRole.OWNER:
        owner_count = session.exec(
            select(func.count(BlogMember.id)).where(BlogMember.blog_id == blog_id, BlogMember.role == BlogRole.OWNER)
        ).one()
        if owner_count <= 1 and membership.user_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Validation Error: You are the sole owner of this blog. Appoint another owner before changing your role."
            )

    # MUTATE FIELDS DYNAMICALLY
    for key, value in update_data.items():
        if key == "permissions" and value is not None:
            # Safely serialize dictionary objects to a JSON text string if stored as text
            membership.permissions = json.dumps(value)
        else:
            setattr(membership, key, value)

    # COMMIT CHANGES AND RUN AUDIT
    session.add(membership)
    add_audit_log(
        session,
        action="blog.member_permissions_update",
        resource_type="blog_member",
        resource_id=membership.user_id,
        blog_id=blog_id,
        actor=current_user,
        details={"updated_fields": list(update_data.keys())},
    )
    session.commit()
    session.refresh(membership)
    return membership


@router.get("/{blog_id}/dashboard", response_model=BlogDashboardSummary)
def get_blog_dashboard_summary(
    blog_id: int,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    role = Permissions.get_user_role_in_blog(current_user, blog_id, session)
    if not role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this blog")

    # Total posts (all statuses)
    posts = session.exec(
        select(func.count(Post.id)).where(Post.blog_id == blog_id)
    ).first() or 0

    # Status-aware counts
    published_posts = session.exec(
        select(func.count(Post.id)).where(
            Post.blog_id == blog_id, 
            Post.status == PostStatus.PUBLISHED
        )
    ).first() or 0

    draft_posts = session.exec(
        select(func.count(Post.id)).where(
            Post.blog_id == blog_id, 
            Post.status == PostStatus.DRAFT
        )
    ).first() or 0

    scheduled_posts = session.exec(
        select(func.count(Post.id)).where(
            Post.blog_id == blog_id, 
            Post.status == PostStatus.SCHEDULED
        )
    ).first() or 0

    comments = session.exec(
        select(func.count(Comment.id))
        .join(Post, Comment.post_id == Post.id)
        .where(Post.blog_id == blog_id)
    ).first() or 0

    tags = session.exec(
        select(func.count(Tag.id)).where(Tag.blog_id == blog_id)
    ).first() or 0

    team_members = session.exec(
        select(func.count(BlogMember.id)).where(BlogMember.blog_id == blog_id)
    ).first() or 0

    total_views = session.exec(
        select(func.sum(Post.views)).where(Post.blog_id == blog_id)
    ).first() or 0

    recent_posts = session.exec(
        select(Post)
        .where(Post.blog_id == blog_id)
        .order_by(Post.updated_at.desc())
        .limit(5)
    ).all()

    recent_activity = [
        DashboardRecentActivity(
            type="post",
            title=post.title,
            description="Updated post" if post.updated_at and post.updated_at != post.created_at else "Created post",
            time=post.updated_at or post.created_at,
        )
        for post in recent_posts
    ]

    return BlogDashboardSummary(
        blog_id=blog.id,
        blog_name=blog.name,
        role=role.value,
        posts=posts,
        published_posts=published_posts,
        draft_posts=draft_posts,
        scheduled_posts=scheduled_posts,
        comments=comments,
        tags=tags,
        team_members=team_members,
        total_views=total_views,
        recent_activity=recent_activity,
    )


@router.get("/{blog_id}/subscription", response_model=SubscriptionRead)
def get_blog_subscription_endpoint(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    subscription = session.exec(
        select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)
    ).first()
    if not subscription:
        subscription = BlogSubscription(blog_id=blog_id, plan=SubscriptionPlan.FREE)
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
    return subscription


# ─── Blog Invitation Routes ────────────────────────────────────────────────────

@router.post("/{blog_id}/invitations", response_model=BlogInvitationRead, status_code=status.HTTP_201_CREATED)
def create_invitation(
    blog_id: int,
    payload: BlogInvitationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    token = secrets.token_urlsafe(32)
    invitation = BlogInvitation(
        blog_id=blog_id,
        role=payload.role,
        token=token,
        created_by=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)
    return invitation


@router.get("/{blog_id}/invitations", response_model=List[BlogInvitationRead])
def list_invitations(
    blog_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return session.exec(
        select(BlogInvitation)
        .where(BlogInvitation.blog_id == blog_id, BlogInvitation.accepted_at == None)
        .order_by(BlogInvitation.created_at.desc())
    ).all()


@router.delete("/{blog_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    blog_id: int,
    invitation_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    invite = session.exec(
        select(BlogInvitation).where(BlogInvitation.id == invitation_id, BlogInvitation.blog_id == blog_id)
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
    session.delete(invite)
    session.commit()


# ─── Public Invitation Routes (no blog prefix) ────────────────────────────────

@invitations_router.get("/{token}", response_model=BlogInvitationInfo)
def get_invitation_info(token: str, session: Session = Depends(get_session)):
    invite = session.exec(select(BlogInvitation).where(BlogInvitation.token == token)).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found or has been revoked")
    if invite.expires_at < datetime.now(timezone.utc) and invite.accepted_at is None:
        raise HTTPException(status_code=410, detail="This invitation link has expired")
    blog = session.get(Blog, invite.blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    return BlogInvitationInfo(
        blog_name=blog.name,
        blog_slug=blog.slug,
        role=invite.role,
        expires_at=invite.expires_at,
        already_accepted=invite.accepted_at is not None,
    )


@invitations_router.post("/{token}/accept", response_model=BlogMemberRead)
def accept_invitation(
    token: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    invite = session.exec(select(BlogInvitation).where(BlogInvitation.token == token)).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found or has been revoked")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This invitation link has expired")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="This invitation has already been accepted")

    # Check if user is already a member
    existing = session.exec(
        select(BlogMember).where(BlogMember.blog_id == invite.blog_id, BlogMember.user_id == current_user.id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this blog")

    membership = BlogMember(
        user_id=current_user.id,
        blog_id=invite.blog_id,
        role=invite.role,
        invited_at=datetime.now(timezone.utc),
    )
    session.add(membership)

    invite.accepted_at = datetime.now(timezone.utc)
    invite.accepted_by = current_user.id
    session.add(invite)
    session.commit()

    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.user_id == current_user.id, BlogMember.blog_id == invite.blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    return membership