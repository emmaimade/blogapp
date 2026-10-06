import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import BackgroundTasks, Request, Response
from jinja2 import Template
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import (
    AuthorizationError,
    BadRequestError,
    ConflictError,
    GoneError,
    NotFoundError,
)
from app.core.permissions import Permissions
from app.core.security import ensure_strong_password, get_password_hash
from app.modules.auth.service import build_login_response
from app.modules.posts.service import upload_welcome_banner
from app.modules.users.router import _generate_random_handle
from app.core.email import dispatch_email
from app.core.email_templates import (
    get_password_reset_template,
    get_password_reset_template_text,
    get_blog_invitation_template,
    get_blog_invitation_template_text,
)
from app.core.notifications import add_notification
from app.services.auth_tokens import create_password_reset_token
from app.models.post import PostStatus
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
    BlogMemberCreate,
    BlogMemberUpdate,
    BlogRead,
    BlogUpdate,
    BrandingSettings,
    ContactSettings,
    DashboardRecentActivity,
    FooterSettings,
    GeneralSettings,
    InvitationRegisterCreate,
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

INVITE_EXPIRY_DAYS = 7


# ── Onboarding / settings helpers ───────────────────────────────────────────

def _render_welcome_template(context: dict) -> str:
    template_path = Path(__file__).parent / "welcome-template.md"
    template_content = template_path.read_text(encoding="utf-8")
    return Template(template_content).render(**context)


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


def _to_subscription_read(subscription: BlogSubscription, blog_name: str) -> SubscriptionRead:
    return SubscriptionRead(
        blog_id=subscription.blog_id,
        blog_name=blog_name,
        plan=subscription.plan,
        status=subscription.status,
        trial_ends_at=subscription.trial_ends_at,
        current_period_ends_at=subscription.current_period_ends_at,
    )


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
    _set_site_setting(session, blog_id, "branding", BrandingSettings().model_dump())
    _set_site_setting(session, blog_id, "general", GeneralSettings().model_dump())
    _set_site_setting(session, blog_id, "footer", FooterSettings().model_dump())
    _set_site_setting(session, blog_id, "seo", SEOSettings().model_dump())
    _set_site_setting(session, blog_id, "contact", ContactSettings().model_dump())
    _set_site_setting(session, blog_id, "about_page", AboutPageSettings().model_dump())
    session.commit()


def _create_welcome_post_on_onboarding_complete(
    session: Session, blog: Blog, current_user: User, request: Request | None = None
) -> Post | None:
    """
    Create a personalised welcome post when onboarding completes.
    Idempotent — if an is_sample post already exists, skip creation.
    """
    existing = session.exec(
        select(Post).where(
            Post.blog_id == blog.id,
            Post.is_sample == True,
        )
    ).first()
    if existing:
        return existing

    banner_url = upload_welcome_banner(blog.name)

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
        request=request,
    )

    return welcome_post


# ── Blog CRUD ────────────────────────────────────────────────────────────────

def create_blog(blog_data: BlogCreate, session: Session, current_user: User, request: Request | None = None) -> Blog:
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

    membership = BlogMember(
        user_id=current_user.id,
        blog_id=new_blog.id,
        role=BlogRole.OWNER,
        invited_at=datetime.now(timezone.utc),
    )
    session.add(membership)
    session.add(BlogSubscription(blog_id=new_blog.id))

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
        request=request,
    )

    superadmins = session.exec(select(User).where(User.is_super_admin == True)).all()
    for admin in superadmins:
        add_notification(
            session,
            user_id=admin.id,
            blog_id=new_blog.id,
            type="tenant_signup",
            title="New tenant signed up",
            body=f'"{new_blog.name}" was just created by {current_user.first_name} {current_user.last_name}',
            link=f"/admin/blogs/{new_blog.id}",
        )

    session.commit()
    return new_blog


def read_blog_by_subdomain(subdomain: str, session: Session) -> Blog:
    blog = session.exec(select(Blog).where(Blog.subdomain == subdomain)).first()
    if not blog or not blog.is_active:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    return blog


def resolve_blog_by_host(host: str, session: Session) -> Blog:
    """
    Resolves a tenant from a full request hostname, covering both our own
    subdomains ({slug}.PUBLIC_BLOG_BASE_DOMAIN) and a tenant-owned custom
    domain — added alongside read_blog_by_subdomain (kept for backward
    compatibility) rather than replacing it.
    """
    host = host.strip().lower()
    base_domain = settings.PUBLIC_BLOG_BASE_DOMAIN.lower()

    if host == base_domain or host.endswith(f".{base_domain}"):
        subdomain = "" if host == base_domain else host[: -len(f".{base_domain}")]
        if subdomain.startswith("www."):
            subdomain = subdomain[4:]
        blog = session.exec(select(Blog).where(Blog.subdomain == subdomain)).first()
    else:
        blog = session.exec(select(Blog).where(Blog.custom_domain == host)).first()

    if not blog or not blog.is_active:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    return blog


_CUSTOM_DOMAIN_PATTERN = re.compile(
    r"^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$"
)


def _normalize_and_validate_custom_domain(session: Session, blog_id: int, raw_domain: str) -> str:
    domain = raw_domain.strip().lower()
    if not _CUSTOM_DOMAIN_PATTERN.match(domain):
        raise BadRequestError(
            ErrorCode.INVALID_INPUT,
            "That doesn't look like a valid domain (e.g. blog.example.com).",
        )
    existing = session.exec(
        select(Blog).where(Blog.custom_domain == domain, Blog.id != blog_id)
    ).first()
    if existing:
        raise ConflictError(
            ErrorCode.RESOURCE_ALREADY_EXISTS,
            "That domain is already connected to another workspace.",
        )
    return domain


def check_slug_availability(slug: str, session: Session) -> dict:
    blog = session.exec(select(Blog).where(Blog.slug == slug)).first()
    return {"available": blog is None}


def update_blog(blog_id: int, blog_data: BlogUpdate, session: Session, current_user: User, request: Request | None = None) -> Blog:
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

    update_dict = blog_data.model_dump(exclude_unset=True)

    if update_dict.get("custom_domain"):
        update_dict["custom_domain"] = _normalize_and_validate_custom_domain(
            session, blog_id, update_dict["custom_domain"]
        )

    # Capture the previous values BEFORE mutating, so the audit log can show
    # exactly what changed (e.g. name "Old Blog" -> "New Blog") rather than
    # just which fields were touched.
    changes = {}
    for key, value in update_dict.items():
        old_value = getattr(blog, key, None)
        if old_value != value:
            changes[key] = {"from": old_value, "to": value}
        setattr(blog, key, value)

    session.add(blog)
    add_audit_log(
        session,
        action="blog.update",
        resource_type="blog",
        resource_id=blog.id,
        blog_id=blog.id,
        actor=current_user,
        details={"changes": changes} if changes else {"fields": []},
        request=request,
    )
    session.commit()
    session.refresh(blog)
    return blog


# ── Onboarding ───────────────────────────────────────────────────────────────

def get_onboarding_state(blog: Blog, session: Session) -> OnboardingState:
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=_to_subscription_read(subscription, blog.name) if subscription else None,
        summary=summary,
    )


def update_onboarding_about(blog_id: int, payload: OnboardingAboutUpdate, session: Session) -> OnboardingState:
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

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
        subscription=_to_subscription_read(subscription, blog.name) if subscription else None,
        summary=summary,
    )


def update_onboarding_profile(blog_id: int, payload: OnboardingProfileUpdate, session: Session) -> OnboardingState:
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

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
    # Seed the footer's tagline from the same value so the public site doesn't
    # show the generic default the moment onboarding finishes. Footer Settings
    # is only reachable after onboarding completes, so this can't yet be
    # clobbering a deliberate edit — merge onto the existing row (rather than
    # replacing it outright) to preserve its other fields regardless.
    existing_footer = session.exec(
        select(SiteSettings).where(SiteSettings.blog_id == blog_id, SiteSettings.setting_key == "footer")
    ).first()
    if existing_footer:
        try:
            footer_data = FooterSettings.model_validate(json.loads(existing_footer.setting_value)).model_dump()
        except Exception:
            footer_data = FooterSettings().model_dump()
    else:
        footer_data = FooterSettings().model_dump()
    footer_data["footer_text"] = payload.tagline
    _set_site_setting(session, blog_id, "footer", footer_data)

    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=_to_subscription_read(subscription, blog.name) if subscription else None,
        summary=summary,
    )


def update_onboarding_publication(blog_id: int, payload: OnboardingPublicationUpdate, session: Session) -> OnboardingState:
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

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
        subscription=_to_subscription_read(subscription, blog.name) if subscription else None,
        summary=summary,
    )


def complete_onboarding_team_step(blog_id: int, payload: OnboardingTeamComplete, session: Session) -> OnboardingState:
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

    _save_team_step_skipped(session, blog_id, payload.skipped)
    blog.onboarding_status = OnboardingStatus.IN_PROGRESS
    blog.onboarding_step = OnboardingStep.PLAN
    session.add(blog)
    summary, subscription = _sync_onboarding_state(session, blog)
    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=_to_subscription_read(subscription, blog.name) if subscription else None,
        summary=summary,
    )


def update_onboarding_plan(blog_id: int, payload: OnboardingPlanUpdate, session: Session, current_user: User, request: Request | None = None) -> OnboardingState:
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

    subscription = _load_subscription(session, blog_id)
    if subscription:
        subscription.plan = payload.plan
        session.add(subscription)
    else:
        subscription = BlogSubscription(blog_id=blog_id, plan=payload.plan)
        session.add(subscription)

    blog.onboarding_status = OnboardingStatus.COMPLETED
    blog.onboarding_step = OnboardingStep.PLAN
    blog.onboarding_completed_at = datetime.now(timezone.utc)
    session.add(blog)

    summary, subscription = _sync_onboarding_state(session, blog)

    _create_welcome_post_on_onboarding_complete(session, blog, current_user, request=request)

    session.commit()
    session.refresh(blog)
    return OnboardingState(
        blog=BlogRead.model_validate(blog),
        subscription=_to_subscription_read(subscription, blog.name) if subscription else None,
        summary=summary,
    )


# ── Members ──────────────────────────────────────────────────────────────────

def read_blog_members(blog_id: int, session: Session) -> List[BlogMember]:
    statement = (
        select(BlogMember)
        .where(BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
        .order_by(BlogMember.invited_at.asc())
    )
    return session.exec(statement).all()


def trigger_member_reset_email(
    blog_id: int,
    member_id: int,
    session: Session,
    current_user: User,
    background_tasks: BackgroundTasks,
    request: Request | None = None,
) -> dict:
    """Allows a blog owner to send a password reset link to a member of their own workspace (Tier 1, workspace-scoped)."""
    membership = session.exec(
        select(BlogMember).where(BlogMember.id == member_id, BlogMember.blog_id == blog_id)
    ).first()
    if not membership:
        raise NotFoundError(ErrorCode.MEMBER_NOT_FOUND)

    user = session.get(User, membership.user_id)
    if not user:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)

    # The send cooldown raises TokenCooldownError, an AppError, so it reaches
    # the client as a 429 with Retry-After without a local conversion here.
    raw_token = create_password_reset_token(session, user.id)

    full_name = f"{user.first_name} {user.last_name}"
    email_html = get_password_reset_template(full_name, raw_token)
    email_text = get_password_reset_template_text(full_name, raw_token)
    dispatch_email(background_tasks, user.email, "Reset your password", email_html, email_text)

    add_audit_log(
        session,
        action="blog_owner.trigger_reset_email",
        resource_type="blog_member",
        resource_id=user.id,
        blog_id=blog_id,
        actor=current_user,
        details={"member_id": membership.id, "target_email": user.email},
        request=request,
    )
    session.commit()

    return {"message": f"A password reset link has been sent to {user.email}."}


def invite_blog_member(blog_id: int, payload: BlogMemberCreate, session: Session, current_user: User, request: Request | None = None) -> BlogMember:
    user_to_invite = session.exec(select(User).where(User.email == payload.email)).first()
    if not user_to_invite:
        raise NotFoundError(
            ErrorCode.USER_NOT_FOUND,
            "No account exists for that email address. Send them an invitation instead.",
        )

    existing = session.exec(
        select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == user_to_invite.id)
    ).first()
    if existing:
        raise ConflictError(ErrorCode.ALREADY_A_MEMBER)

    if user_to_invite.id == current_user.id:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "You are already part of this workspace.",
        )

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
        request=request,
    )
    session.commit()

    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.user_id == user_to_invite.id, BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    return membership


def remove_blog_member(blog_id: int, member_id: int, session: Session, current_user: User, request: Request | None = None) -> None:
    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.id == member_id, BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    if not membership:
        raise NotFoundError(ErrorCode.MEMBER_NOT_FOUND)
    if membership.role == BlogRole.OWNER:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "The workspace owner cannot be removed. Transfer ownership first.",
        )
    if membership.user_id == current_user.id:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "You cannot remove yourself from the workspace.",
        )

    add_audit_log(
        session,
        action="blog.member_remove",
        resource_type="blog_member",
        resource_id=membership.user_id,
        blog_id=blog_id,
        actor=current_user,
        details={
            "member_id": membership.id,
            "email": membership.user.email if membership.user else None,
            "role": membership.role,
        },
        request=request,
    )
    session.delete(membership)
    session.commit()


def update_blog_member_permissions(
    blog_id: int,
    member_id: int,
    payload: BlogMemberUpdate,
    session: Session,
    current_user: User,
    request: Request | None = None,
) -> BlogMember:
    # Allow access if the user is a global superadmin OR a verified workspace owner
    is_super_admin = current_user.is_super_admin or getattr(current_user, "platform_role", None) == "superadmin"

    if not is_super_admin:
        actor_membership = session.exec(
            select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == current_user.id)
        ).first()
        if not actor_membership or actor_membership.role != BlogRole.OWNER:
            raise AuthorizationError(
                ErrorCode.INSUFFICIENT_PERMISSIONS,
                "Only a workspace owner can change member permissions.",
            )

    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.id == member_id, BlogMember.blog_id == blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    if not membership:
        raise NotFoundError(ErrorCode.MEMBER_NOT_FOUND)

    update_data = payload.model_dump(exclude_unset=True)

    # Safety Rule: Prevent a lone workspace owner from accidentally demoting themselves
    if "role" in update_data and update_data["role"] != BlogRole.OWNER and membership.role == BlogRole.OWNER:
        owner_count = session.exec(
            select(func.count(BlogMember.id)).where(BlogMember.blog_id == blog_id, BlogMember.role == BlogRole.OWNER)
        ).one()
        if owner_count <= 1 and membership.user_id == current_user.id:
            raise BadRequestError(
                ErrorCode.OPERATION_NOT_ALLOWED,
                "You are the only owner of this workspace. Make someone else an "
                "owner before changing your own role.",
            )

    # Capture BEFORE values so the audit log can say what actually changed
    # (e.g. role: editor -> owner) instead of just which fields were touched.
    changes = {}
    if "role" in update_data and update_data["role"] != membership.role:
        changes["role"] = {"from": membership.role, "to": update_data["role"]}
    if "permissions" in update_data:
        changes["permissions"] = {"from": membership.permissions, "to": update_data["permissions"]}

    for key, value in update_data.items():
        if key == "permissions" and value is not None:
            membership.permissions = json.dumps(value)
        else:
            setattr(membership, key, value)

    session.add(membership)
    add_audit_log(
        session,
        action="blog.member_permissions_update",
        resource_type="blog_member",
        resource_id=membership.user_id,
        blog_id=blog_id,
        actor=current_user,
        details={
            "target_name": membership.user.first_name + " " + membership.user.last_name if membership.user else None,
            "member_id": membership.id,
            "changes": changes,
        },
        request=request,
    )
    session.commit()
    session.refresh(membership)
    return membership


# ── Dashboard ────────────────────────────────────────────────────────────────

def get_blog_dashboard_summary(blog: Blog, session: Session, current_user: User) -> BlogDashboardSummary:
    role = Permissions.get_user_role_in_blog(current_user, blog.id, session)
    if not role:
        raise AuthorizationError(ErrorCode.NOT_A_MEMBER)

    # Authors see stats scoped to posts they authored; Owner/Editor see the
    # whole workspace. Tags and team size are workspace-level facts, not
    # content anyone "owns", so they stay unscoped for every role.
    is_author_only = role == BlogRole.AUTHOR
    post_scope = [Post.blog_id == blog.id]
    if is_author_only:
        post_scope.append(Post.author_id == current_user.id)

    posts = session.exec(select(func.count(Post.id)).where(*post_scope)).first() or 0

    published_posts = session.exec(
        select(func.count(Post.id)).where(*post_scope, Post.status == PostStatus.PUBLISHED)
    ).first() or 0

    draft_posts = session.exec(
        select(func.count(Post.id)).where(*post_scope, Post.status == PostStatus.DRAFT)
    ).first() or 0

    scheduled_posts = session.exec(
        select(func.count(Post.id)).where(*post_scope, Post.status == PostStatus.SCHEDULED)
    ).first() or 0

    # Comments scoped the same way — an Author sees comment volume on
    # *their* posts only, not the whole blog's comment activity.
    comments = session.exec(
        select(func.count(Comment.id))
        .join(Post, Comment.post_id == Post.id)
        .where(*post_scope)
    ).first() or 0

    tags = session.exec(
        select(func.count(Tag.id)).where(Tag.blog_id == blog.id)
    ).first() or 0

    team_members = session.exec(
        select(func.count(BlogMember.id)).where(BlogMember.blog_id == blog.id)
    ).first() or 0

    total_views = session.exec(
        select(func.sum(Post.views)).where(*post_scope)
    ).first() or 0

    recent_posts = session.exec(
        select(Post)
        .where(*post_scope)
        .order_by(Post.updated_at.desc())
        .limit(5)
    ).all()

    post_activity = [
        DashboardRecentActivity(
            type="post",
            title=post.title,
            description="Updated post" if post.updated_at and post.updated_at != post.created_at else "Created post",
            time=post.updated_at or post.created_at,
        )
        for post in recent_posts
    ]

    # Comments on posts within scope — this is what surfaces "someone
    # commented on your post" for Authors, alongside blog-wide comment
    # activity for Owner/Editor.
    recent_comments = session.exec(
        select(Comment)
        .join(Post, Comment.post_id == Post.id)
        .where(*post_scope, Comment.is_deleted == False)
        .options(selectinload(Comment.user), selectinload(Comment.post))
        .order_by(Comment.created_at.desc())
        .limit(5)
    ).all()

    comment_activity = [
        DashboardRecentActivity(
            type="comment",
            title=f'New comment on "{comment.post.title if comment.post else "a post"}"',
            description=(
                f"{comment.user.first_name} {comment.user.last_name} commented"
                if comment.user else "A reader commented"
            ),
            time=comment.created_at,
        )
        for comment in recent_comments
    ]

    recent_activity = sorted(
        post_activity + comment_activity,
        key=lambda item: item.time,
        reverse=True,
    )[:5]

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


# ── Subscriptions ────────────────────────────────────────────────────────────

def get_blog_subscription(blog: Blog, session: Session) -> SubscriptionRead:
    subscription = session.exec(
        select(BlogSubscription).where(BlogSubscription.blog_id == blog.id)
    ).first()
    if not subscription:
        subscription = BlogSubscription(blog_id=blog.id, plan=SubscriptionPlan.FREE)
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
    return _to_subscription_read(subscription, blog.name)


# ── Invitations (owner-scoped) ───────────────────────────────────────────────

def create_invitation(
    blog_id: int,
    payload: BlogInvitationCreate,
    session: Session,
    current_user: User,
    background_tasks: BackgroundTasks,
) -> BlogInvitation:
    normalized_email = payload.email.strip().lower()

    # Don't invite someone who's already on the team
    existing_user = session.exec(select(User).where(User.email == normalized_email)).first()
    if existing_user:
        existing_membership = session.exec(
            select(BlogMember).where(BlogMember.blog_id == blog_id, BlogMember.user_id == existing_user.id)
        ).first()
        if existing_membership:
            raise ConflictError(ErrorCode.ALREADY_A_MEMBER)

    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

    # If there's already a pending (unexpired, unaccepted) invite for this
    # email, treat this as a resend rather than creating a duplicate record —
    # refresh the token, role, and expiry instead of stacking up invitations.
    pending = session.exec(
        select(BlogInvitation).where(
            BlogInvitation.blog_id == blog_id,
            BlogInvitation.email == normalized_email,
            BlogInvitation.accepted_at == None,
            BlogInvitation.expires_at > datetime.now(timezone.utc),
        )
    ).first()

    if pending:
        pending.role = payload.role
        pending.token = secrets.token_urlsafe(32)
        pending.expires_at = datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS)
        pending.created_by = current_user.id
        invitation = pending
        session.add(invitation)
    else:
        invitation = BlogInvitation(
            blog_id=blog_id,
            email=normalized_email,
            role=payload.role,
            token=secrets.token_urlsafe(32),
            created_by=current_user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
        )
        session.add(invitation)

    session.commit()
    session.refresh(invitation)

    admin_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    invite_url = f"{admin_url}/join/{invitation.token}"
    inviter_name = f"{current_user.first_name} {current_user.last_name}"

    email_html = get_blog_invitation_template(inviter_name, blog.name, payload.role.value, invite_url)
    email_text = get_blog_invitation_template_text(inviter_name, blog.name, payload.role.value, invite_url)
    dispatch_email(background_tasks, normalized_email, f"You've been invited to join {blog.name}", email_html, email_text)

    return invitation


def list_invitations(blog_id: int, session: Session) -> List[BlogInvitation]:
    return session.exec(
        select(BlogInvitation)
        .where(BlogInvitation.blog_id == blog_id, BlogInvitation.accepted_at == None)
        .order_by(BlogInvitation.created_at.desc())
    ).all()


def revoke_invitation(blog_id: int, invitation_id: int, session: Session) -> None:
    invite = session.exec(
        select(BlogInvitation).where(BlogInvitation.id == invitation_id, BlogInvitation.blog_id == blog_id)
    ).first()
    if not invite:
        raise NotFoundError(ErrorCode.INVITATION_NOT_FOUND)
    session.delete(invite)
    session.commit()


# ── Invitations (public) ─────────────────────────────────────────────────────

def get_invitation_info(token: str, session: Session) -> BlogInvitationInfo:
    invite = session.exec(select(BlogInvitation).where(BlogInvitation.token == token)).first()
    if not invite:
        raise NotFoundError(ErrorCode.INVITATION_NOT_FOUND)
    if as_utc(invite.expires_at) < utc_now() and invite.accepted_at is None:
        raise GoneError(ErrorCode.INVITATION_EXPIRED)
    blog = session.get(Blog, invite.blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    return BlogInvitationInfo(
        blog_name=blog.name,
        blog_slug=blog.slug,
        email=invite.email,
        role=invite.role,
        expires_at=invite.expires_at,
        already_accepted=invite.accepted_at is not None,
    )


def accept_invitation(token: str, session: Session, current_user: User) -> BlogMember:
    invite = session.exec(select(BlogInvitation).where(BlogInvitation.token == token)).first()
    if not invite:
        raise NotFoundError(ErrorCode.INVITATION_NOT_FOUND)
    if as_utc(invite.expires_at) < utc_now():
        raise GoneError(ErrorCode.INVITATION_EXPIRED)
    if invite.accepted_at is not None:
        raise ConflictError(ErrorCode.INVITATION_ALREADY_ACCEPTED)

    if current_user.email.strip().lower() != invite.email.strip().lower():
        raise AuthorizationError(
            ErrorCode.FORBIDDEN,
            "This invitation was sent to a different email address. "
            "Please sign in with the invited account.",
        )

    existing = session.exec(
        select(BlogMember).where(BlogMember.blog_id == invite.blog_id, BlogMember.user_id == current_user.id)
    ).first()
    if existing:
        raise ConflictError(
            ErrorCode.ALREADY_A_MEMBER,
            "You are already a member of this workspace.",
        )

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

    blog = session.get(Blog, invite.blog_id)
    if blog and blog.owner_id != current_user.id:
        add_notification(
            session,
            user_id=blog.owner_id,
            blog_id=blog.id,
            type="invitation_accepted",
            title=f'{current_user.first_name} {current_user.last_name} joined {blog.name}',
            body=f"Accepted as {invite.role.value if hasattr(invite.role, 'value') else invite.role}",
            link=f"/admin/users?blog={blog.id}",
        )

    session.commit()

    membership = session.exec(
        select(BlogMember)
        .where(BlogMember.user_id == current_user.id, BlogMember.blog_id == invite.blog_id)
        .options(selectinload(BlogMember.user))
    ).first()
    return membership


def register_and_accept_invitation(token: str, payload: InvitationRegisterCreate, session: Session, response: Response, request: Request | None = None):
    """
    Creates a brand-new account for someone who doesn't have one yet and
    immediately accepts the invitation with it — deliberately skips
    workspace creation entirely, since the workspace is already fixed by
    the invitation. This is the invite-flow counterpart to /users/register,
    which always creates a new Blog alongside the User.
    """
    invite = session.exec(select(BlogInvitation).where(BlogInvitation.token == token)).first()
    if not invite:
        raise NotFoundError(ErrorCode.INVITATION_NOT_FOUND)
    if as_utc(invite.expires_at) < utc_now():
        raise GoneError(ErrorCode.INVITATION_EXPIRED)
    if invite.accepted_at is not None:
        raise ConflictError(ErrorCode.INVITATION_ALREADY_ACCEPTED)

    existing_user = session.exec(select(User).where(User.email == invite.email)).first()
    if existing_user:
        raise ConflictError(
            ErrorCode.EMAIL_ALREADY_EXISTS,
            "An account with this email already exists. Please log in instead.",
        )

    # Uses the shared policy in app.core.security rather than a local length
    # check, so this signup path cannot drift away from /auth/reset-password
    # and /auth/change-password the way it previously had.
    ensure_strong_password(payload.password, field="password")

    random_handle = _generate_random_handle(invite.email, session)
    hashed = get_password_hash(payload.password)

    new_user = User(
        username=random_handle,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=invite.email,
        hashed_password=hashed,
        # The invite was emailed to this exact address, which is itself
        # proof of ownership — same reasoning Slack/Notion use to skip a
        # redundant "check your email" step right after they just did.
        email_verified=True,
        # This endpoint hands back a real access token and drops the user
        # straight onto their dashboard, same as /auth/login does — so it
        # needs to stamp last_login too, or the Users table wrongly shows
        # "Never logged in" for members who are actively using the app.
        last_login=datetime.now(timezone.utc),
    )
    session.add(new_user)
    session.flush()

    membership = BlogMember(
        user_id=new_user.id,
        blog_id=invite.blog_id,
        role=invite.role,
        invited_at=datetime.now(timezone.utc),
    )
    session.add(membership)

    invite.accepted_at = datetime.now(timezone.utc)
    invite.accepted_by = new_user.id
    session.add(invite)

    add_audit_log(
        session,
        action="user.register_via_invite",
        resource_type="user",
        resource_id=new_user.id,
        actor=new_user,
        blog_id=invite.blog_id,
        details={"role": invite.role.value},
        request=request,
    )

    blog = session.get(Blog, invite.blog_id)
    if blog and blog.owner_id != new_user.id:
        add_notification(
            session,
            user_id=blog.owner_id,
            blog_id=blog.id,
            type="invitation_accepted",
            title=f'{new_user.first_name} {new_user.last_name} joined {blog.name}',
            body=f"Accepted as {invite.role.value}",
            link=f"/admin/users?blog={blog.id}",
        )

    session.commit()
    session.refresh(new_user)

    return build_login_response(new_user, session, response)
