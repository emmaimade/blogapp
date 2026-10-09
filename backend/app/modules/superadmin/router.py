import json
import secrets
import string
from typing import Any, List, Optional
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, status, Request, Response, BackgroundTasks
from sqlmodel import Session, select
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import BadRequestError, NotFoundError, ValidationError
from app.core.moderation import record_moderation_action
from app.core.notifications import add_notification
from app.core.permissions import require_super_admin
from app.core.security import get_current_user, get_password_hash
from app.core.email import dispatch_email
from app.core.email_templates import get_password_reset_template, get_password_reset_template_text, get_temporary_password_issued_template, get_temporary_password_issued_template_text
from app.services.auth_tokens import create_password_reset_token
from app.models import (
    AuditLog,
    Blog,
    User,
    Post,
    Tag,
    Comment,
    ModerationItem,
    BlogMember,
    SupportTicket,
    SupportMessage,
    TicketStatus,
    PlatformSettings as PlatformSettingsRecord)
from app.models.comment import CommentDeletedBy
from app.modules.comments.service import soft_delete_comment
from app.modules.support.router import SupportTicketRead
from app.schemas import (
    AuditLogRead,
    BlogAnalytics,
    ModerationActionCreate,
    ModerationActionRead,
    ModerationQueueItemRead,
    ModerationQueueQueryParams,
    PlatformSettings,
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
    PlatformStats,
    UserRead,
    SuperadminUserQueryParams,
)

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

# Response models for superadmin endpoints
class UserSuspendUpdate(BaseModel):
    is_active: bool

class BlogToggleActive(BaseModel):
    is_active: bool


class UpdateTicketStatusSchema(BaseModel):
    status: TicketStatus


class RecentPostSummary(BaseModel):
    id: int
    title: str
    published: bool
    created_at: datetime
    views: int = 0


class MemberSummary(BaseModel):
    user_id: int
    email: str
    role: str
    joined_at: Optional[datetime] = None


class BlogDetailAnalytics(BlogAnalytics):  # or just extend BlogAnalytics
    recent_posts: List[RecentPostSummary] = []
    members: List[MemberSummary] = []


def _generate_temporary_password(length: int = 12) -> str:
    """Generates a secure random temporary password guaranteed to satisfy the app's own password policy (letters + digits)."""
    alphabet = string.ascii_letters + string.digits
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isalpha() for c in candidate) and any(c.isdigit() for c in candidate):
            return candidate


@router.get("/stats", response_model=PlatformStats)
def get_platform_stats(
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    today = datetime.utcnow().date()

    total_blogs  = session.exec(select(func.count(Blog.id))).first() or 0
    active_blogs = session.exec(select(func.count(Blog.id)).where(Blog.is_active == True)).first() or 0
    total_users  = session.exec(select(func.count(User.id))).first() or 0
    total_posts  = session.exec(select(func.count(Post.id))).first() or 0
    total_views  = session.exec(select(func.sum(Post.views))).first() or 0

    blogs_created_today = session.exec(
        select(func.count(Blog.id)).where(cast(Blog.created_at, Date) == today)
    ).first() or 0

    users_signed_up_today = session.exec(
        select(func.count(User.id)).where(cast(User.created_at, Date) == today)
    ).first() or 0

    return PlatformStats(
        total_blogs=total_blogs,
        active_blogs=active_blogs,
        total_users=total_users,
        total_posts=total_posts,
        total_views=total_views,
        blogs_created_today=blogs_created_today,
        users_signed_up_today=users_signed_up_today,
    )


@router.get("/blogs", response_model=List[BlogAnalytics])
def get_all_blogs_analytics(
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    blogs = session.exec(select(Blog)).all()
    results = []
    for blog in blogs:
        posts_count = session.exec(
            select(func.count(Post.id)).where(Post.blog_id == blog.id)
        ).first() or 0
        views = session.exec(
            select(func.sum(Post.views)).where(Post.blog_id == blog.id)
        ).first() or 0
        member_count = len(blog.members) if hasattr(blog, "members") else 0
        last_post = session.exec(
            select(Post.created_at)
            .where(Post.blog_id == blog.id)
            .order_by(Post.created_at.desc())
        ).first()
        results.append(
            BlogAnalytics(
                blog_id=blog.id,
                blog_name=blog.name,
                name=blog.name,
                subdomain=blog.subdomain,
                custom_domain=blog.custom_domain,
                is_active=blog.is_active,
                owner_email=blog.owner.email if blog.owner else "",
                total_posts=posts_count,
                total_views=views,
                team_members=member_count,
                created_at=blog.created_at,
                last_activity=last_post,
            )
        )
    return results


# ============================================================================
# BLOG MANAGEMENT ENDPOINTS
# ============================================================================
@router.get("/blogs/{blog_id}", response_model=BlogDetailAnalytics)
def get_blog_detail(
    blog_id: int,
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """Return a single blog/workspace for the superadmin detail view."""
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

    posts_count = session.exec(
        select(func.count(Post.id)).where(Post.blog_id == blog.id)
    ).first() or 0
    views = session.exec(
        select(func.sum(Post.views)).where(Post.blog_id == blog.id)
    ).first() or 0
    member_count = len(blog.members) if hasattr(blog, "members") else 0
    last_post = session.exec(
        select(Post.created_at)
        .where(Post.blog_id == blog.id)
        .order_by(Post.created_at.desc())
    ).first()

    # --- new: recent posts (last 8) ---
    recent_posts_rows = session.exec(
        select(Post)
        .where(Post.blog_id == blog.id)
        .order_by(Post.created_at.desc())
        .limit(8)
    ).all()
    recent_posts = [
        RecentPostSummary(
            id=p.id,
            title=p.title or "Untitled",
            published=bool(getattr(p, "published", False)),
            created_at=p.created_at,
            views=getattr(p, "views", 0) or 0,
        )
        for p in recent_posts_rows
    ]

    # --- new: members ---
    members = []
    if hasattr(blog, "members"):
        for m in blog.members:
            user = getattr(m, "user", None)
            members.append(
                MemberSummary(
                    user_id=m.user_id,
                    email=user.email if user else "unknown",
                    role=getattr(m, "role", "member") or "member",
                    joined_at=getattr(m, "created_at", None),
                )
            )

    return BlogDetailAnalytics(
        blog_id=blog.id,
        blog_name=blog.name,
        name=blog.name,
        subdomain=blog.subdomain,
        custom_domain=blog.custom_domain,
        is_active=blog.is_active,
        owner_email=blog.owner.email if blog.owner else "",
        total_posts=posts_count,
        total_views=views,
        team_members=member_count,
        created_at=blog.created_at,
        last_activity=last_post,
        recent_posts=recent_posts,
        members=members,
    )


@router.patch("/blogs/{blog_id}", response_model=BlogAnalytics)
def update_blog_status(
    blog_id: int,
    data: BlogToggleActive,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Toggle a blog's active status."""
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    
    previous_is_active = blog.is_active
    blog.is_active = data.is_active
    session.add(blog)
    add_audit_log(
        session,
        action="superadmin.blog_status_update",
        resource_type="blog",
        resource_id=blog.id,
        blog_id=blog.id,
        actor=current_user,
        details={"from": previous_is_active, "to": blog.is_active},
        request=request,
    )
    session.commit()
    session.refresh(blog)
    
    posts_count = session.exec(
        select(func.count(Post.id)).where(Post.blog_id == blog.id)
    ).first() or 0
    views = session.exec(
        select(func.sum(Post.views)).where(Post.blog_id == blog.id)
    ).first() or 0
    member_count = len(blog.members) if hasattr(blog, "members") else 0
    last_post = session.exec(
        select(Post.created_at)
        .where(Post.blog_id == blog.id)
        .order_by(Post.created_at.desc())
    ).first()
    
    return BlogAnalytics(
        blog_id=blog.id,
        blog_name=blog.name,
        name=blog.name,
        subdomain=blog.subdomain,
        custom_domain=blog.custom_domain,
        is_active=blog.is_active,
        owner_email=blog.owner.email if blog.owner else "",
        total_posts=posts_count,
        total_views=views,
        team_members=member_count,
        created_at=blog.created_at,
        last_activity=last_post,
    )


@router.delete("/blogs/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog(
    blog_id: int,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently delete a blog and all its content."""
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    
    # Delete all posts
    posts = session.exec(select(Post).where(Post.blog_id == blog_id)).all()
    for post in posts:
        session.delete(post)
    
    # Delete all members
    from app.models.blog import BlogMember
    members = session.exec(select(BlogMember).where(BlogMember.blog_id == blog_id)).all()
    for member in members:
        session.delete(member)
    
    add_audit_log(
        session,
        action="superadmin.blog_delete",
        resource_type="blog",
        resource_id=blog.id,
        blog_id=blog.id,
        actor=current_user,
        details={"name": blog.name},
        request=request,
    )

    # Delete blog
    session.delete(blog)
    session.commit()


# ============================================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/users", response_model=List[UserRead])
def get_all_users(
    params: SuperadminUserQueryParams = Depends(),  # Query parameters encapsulated
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    # Base query optimizing loads
    query = select(User).options(
        selectinload(User.blog_memberships).selectinload(BlogMember.blog)
    )

    # Applying conditional adjustments from your schema parameter state
    if not params.include_deleted:
        query = query.where(User.deleted_at == None)
        
    if params.platform_role:
        query = query.where(User.platform_role == params.platform_role)
        
    if params.search:
        search_term = f"%{params.search}%"
        query = query.where(
            (User.username.ilike(search_term)) | (User.email.ilike(search_term))
        )

    # Execute offset/limit pagination parameters clean boundary
    query = query.order_by(User.created_at.desc()).offset(params.skip).limit(params.limit)
    
    users = session.exec(query).all()
    return users


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user_status(
    user_id: int,
    data: UserSuspendUpdate,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Suspend or activate a user account safely."""
    # FIX: Eagerly load relationship so the UserRead response schema receives its expected blog_memberships list
    statement = select(User).where(User.id == user_id).options(selectinload(User.blog_memberships))
    user = session.exec(statement).first()
    
    if not user:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)
    
    previous_is_active = user.is_active
    user.is_active = data.is_active
    session.add(user)
    
    add_audit_log(
        session,
        action="superadmin.user_status_update",
        resource_type="user",
        resource_id=user.id,
        actor=current_user,
        details={"from": previous_is_active, "to": user.is_active},
        request=request,
    )
    session.commit()
    session.refresh(user)
    
    return user


@router.patch("/users/{user_id}/force-temporary-password")
def force_temporary_password(
    user_id: int,
    background_tasks: BackgroundTasks,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Immediately overwrites a user's password with a generated temporary one and forces them to change it at next login (Tier 2)."""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)

    if user.id == current_user.id:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "You cannot set a temporary password on your own account. "
            "Use the change password form instead.",
        )

    temporary_password = _generate_temporary_password()
    user.hashed_password = get_password_hash(temporary_password)
    user.must_change_password = True
    session.add(user)

    add_audit_log(
        session,
        action="superadmin.force_temporary_password",
        resource_type="user",
        resource_id=user.id,
        actor=current_user,
        request=request,
    )
    session.commit()

    full_name = f"{user.first_name} {user.last_name}"
    email_html = get_temporary_password_issued_template(full_name)
    email_text = get_temporary_password_issued_template_text(full_name)
    dispatch_email(background_tasks, user.email, "A temporary password has been set on your account", email_html, email_text)

    return {"temporary_password": temporary_password}


@router.post("/users/{user_id}/trigger-reset-email")
def trigger_reset_email(
    user_id: int,
    background_tasks: BackgroundTasks,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Send a password reset link to any user's own mailbox (Tier 1, platform-wide)."""
    user = session.get(User, user_id)
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
        action="superadmin.trigger_reset_email",
        resource_type="user",
        resource_id=user.id,
        actor=current_user,
        request=request,
    )
    session.commit()

    return {"message": f"A password reset link has been sent to {user.email}."}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def superadmin_delete_user(
    user_id: int,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently (or softly) delete a user account by superadmin."""
    user = session.get(User, user_id)
    if not user:
        raise NotFoundError(ErrorCode.USER_NOT_FOUND)

    if user.id == current_user.id:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "You cannot delete your own account from here.",
        )

    # Prevent deleting the last superadmin
    if user.is_super_admin:
        remaining_superadmins = session.exec(
            select(User).where(
                User.is_super_admin == True,
                User.id != user.id
            )
        ).all()
        if len(remaining_superadmins) <= 0:
            raise BadRequestError(
                ErrorCode.OPERATION_NOT_ALLOWED,
                "This is the last super admin account and cannot be deleted.",
            )

    # Audit before deletion
    add_audit_log(
        session,
        action="superadmin.user_delete",
        resource_type="user",
        resource_id=user.id,
        actor=current_user,
        details={
            "username": user.username,
            "email": user.email,
            "was_superadmin": user.is_super_admin,
            "owned_blogs_count": len(user.owned_blogs) if hasattr(user, "owned_blogs") else 0
        },
        request=request,
    )

    # === SOFT DELETE ===
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc) # Fixed deprecated utcnow()
    
    # Free up username and email for re-registration while maintaining DB integrity/FKs
    user.username = f"deleted_{user.id}_{user.username}"
    user.email = f"deleted_{user.id}_{user.email}"

    session.add(user)
    session.commit()

    # FIX: Explicitly return an empty Response with a 204 status code 
    # This prevents FastAPI from running validations on a 'None' return value
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# PLATFORM SETTINGS ENDPOINTS
# ============================================================================

PLATFORM_SETTINGS_KEY = "platform"


def _diff_top_level_fields(old_values: dict[str, Any], new_values: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """
    Compare old vs new top-level settings fields and return only what actually
    changed, as {"from": ..., "to": ...}. For nested/object fields this shows
    the whole old/new sub-object rather than a deep per-key diff — still far
    more useful than a bare list of field names.
    """
    changes: dict[str, dict[str, Any]] = {}
    for key, new_value in new_values.items():
        old_value = old_values.get(key)
        if old_value != new_value:
            changes[key] = {"from": old_value, "to": new_value}
    return changes


def _deep_merge(base: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _apply_compatibility_projection(payload: dict[str, Any]) -> dict[str, Any]:
    projected = dict(payload)
    feature_flags = projected.get("feature_flags") or {}
    free_plan = ((projected.get("plans") or {}).get("free")) or {}

    if "feature_custom_domains" not in projected and "custom_domains" in feature_flags:
        projected["feature_custom_domains"] = feature_flags["custom_domains"]
    if "feature_api_access" not in projected and "api_access" in feature_flags:
        projected["feature_api_access"] = feature_flags["api_access"]
    if "feature_analytics" not in projected and "analytics" in feature_flags:
        projected["feature_analytics"] = feature_flags["analytics"]
    if "feature_sso" not in projected and "sso" in feature_flags:
        projected["feature_sso"] = feature_flags["sso"]
    if "feature_comments" not in projected and "comments" in feature_flags:
        projected["feature_comments"] = feature_flags["comments"]
    if "feature_newsletters" not in projected and "newsletters" in feature_flags:
        projected["feature_newsletters"] = feature_flags["newsletters"]

    if "max_blogs_per_user" not in projected and "max_blogs_per_user" in free_plan:
        projected["max_blogs_per_user"] = free_plan["max_blogs_per_user"]
    if "max_members_per_blog" not in projected and "max_members_per_blog" in free_plan:
        projected["max_members_per_blog"] = free_plan["max_members_per_blog"]

    return projected


def _normalize_platform_settings(settings: PlatformSettings) -> PlatformSettings:
    settings.feature_flags.custom_domains = settings.feature_custom_domains
    settings.feature_flags.api_access = settings.feature_api_access
    settings.feature_flags.analytics = settings.feature_analytics
    settings.feature_flags.sso = settings.feature_sso
    settings.feature_flags.comments = settings.feature_comments
    settings.feature_flags.newsletters = settings.feature_newsletters

    settings.plans.free.max_blogs_per_user = settings.max_blogs_per_user
    settings.plans.free.max_members_per_blog = settings.max_members_per_blog

    return settings


def _load_platform_settings(session: Session) -> PlatformSettings:
    record = session.exec(
        select(PlatformSettingsRecord).where(PlatformSettingsRecord.setting_key == PLATFORM_SETTINGS_KEY)
    ).first()
    if not record:
        return _normalize_platform_settings(PlatformSettings())

    try:
        payload = json.loads(record.setting_value)
    except (TypeError, json.JSONDecodeError):
        payload = {}

    return _normalize_platform_settings(
        PlatformSettings.model_validate(_apply_compatibility_projection(payload))
    )


def _save_platform_settings(session: Session, settings: PlatformSettings) -> PlatformSettings:
    normalized = _normalize_platform_settings(settings)
    record = session.exec(
        select(PlatformSettingsRecord).where(PlatformSettingsRecord.setting_key == PLATFORM_SETTINGS_KEY)
    ).first()

    if record:
        record.setting_value = json.dumps(normalized.model_dump(mode="json"))
        record.updated_at = datetime.utcnow()
        session.add(record)
    else:
        session.add(
            PlatformSettingsRecord(
                setting_key=PLATFORM_SETTINGS_KEY,
                setting_value=json.dumps(normalized.model_dump(mode="json")),
                updated_at=datetime.utcnow(),
            )
        )

    session.commit()
    return normalized


@router.get("/platform-settings", response_model=PlatformSettingsResponse)
def get_platform_settings(
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """Get current platform settings."""
    return PlatformSettingsResponse.model_validate(_load_platform_settings(session))


@router.patch("/platform-settings", response_model=PlatformSettingsResponse)
def update_platform_settings(
    data: PlatformSettingsUpdate,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update platform settings."""
    current = _load_platform_settings(session)
    incoming = data.model_dump(exclude_unset=True, mode="json")
    merged = _apply_compatibility_projection(_deep_merge(
        current.model_dump(mode="json"),
        incoming,
    ))
    saved = _save_platform_settings(session, PlatformSettings.model_validate(merged))
    changes = _diff_top_level_fields(current.model_dump(mode="json"), incoming)
    add_audit_log(
        session,
        action="superadmin.platform_settings_update",
        resource_type="platform_settings",
        actor=current_user,
        details={"changes": changes} if changes else {"fields": []},
        request=request,
    )
    session.commit()
    return PlatformSettingsResponse.model_validate(saved)


# ============================================================================
# SUBSCRIPTIONS ENDPOINTS
# ============================================================================

# Served by app/modules/billing/router.py (list, detail, extend trial, grant plan).


# ============================================================================
# MODERATION ENDPOINTS
# ============================================================================

@router.get("/moderation", response_model=List[ModerationQueueItemRead])
def get_moderation_queue(
    params: ModerationQueueQueryParams = Depends(),  # Cleaner dependency decoupling
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    statement = (
        select(ModerationItem, Blog.name)
        .join(Blog, Blog.id == ModerationItem.blog_id)
    )

    # Injecting the constraints cleanly through schema variables
    if params.status:
        statement = statement.where(ModerationItem.status == params.status)
    if params.content_type:
        statement = statement.where(ModerationItem.content_type == params.content_type)

    # Order and paginate using standard clean parameter sets
    statement = (
        statement.order_by(ModerationItem.created_at.desc())
        .offset(params.skip)
        .limit(params.limit)
    )

    rows = session.exec(statement).all()
    return [
        ModerationQueueItemRead(
            id=item.id,
            blog_id=item.blog_id,
            blog_name=blog_name,
            item_type=item.content_type,
            content_id=item.content_id,
            author=item.snapshot_author or "Unknown",
            content=item.snapshot_content,
            reason=item.reason,
            notes=item.notes,
            status=item.status,
            reported_by_id=item.reported_by_id,
            created_at=item.created_at,
        )
        for item, blog_name in rows
    ]


@router.post("/moderation/{item_id}/actions", response_model=ModerationActionRead)
def moderate_flagged_content(
    item_id: int,
    payload: ModerationActionCreate,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Persist a moderation decision and apply content changes when needed."""
    action = payload.action.lower()
    if action not in {"approve", "reject", "remove"}:
        raise ValidationError(errors={"action": "Choose approve, reject, or remove."})

    item = session.get(ModerationItem, item_id)
    if not item:
        raise NotFoundError(ErrorCode.MODERATION_ITEM_NOT_FOUND)

    if action == "remove":
        _remove_flagged_content(session, item)

    item.status = {
        "approve": "approved",
        "reject": "rejected",
        "remove": "removed",
    }[action]
    item.resolved_by_id = current_user.id
    item.resolved_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()
    session.add(item)

    moderation_action = record_moderation_action(
        session,
        item=item,
        actor=current_user,
        action=action,
        notes=payload.notes,
        request=request,
    )
    session.commit()
    session.refresh(moderation_action)
    return moderation_action


# ============================================================================
# AUDIT LOG ENDPOINTS
# ============================================================================

@router.get("/audit-logs", response_model=List[AuditLogRead])
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    blog_id: Optional[int] = None,
    actor_user_id: Optional[int] = None,
    action: Optional[str] = None,
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """Get platform audit logs."""
    safe_limit = max(1, min(limit, 200))
    # Exclude the generic http.* rows the AuditLogMiddleware writes for every
    # POST/PATCH/PUT/DELETE — they're noise duplicates of the semantic action
    # already logged in the router (e.g. "user.login" already covers what
    # "http.post" on /users/login would otherwise repeat).
    statement = select(AuditLog).where(~AuditLog.action.startswith("http."))
    if blog_id is not None:
        statement = statement.where(AuditLog.blog_id == blog_id)
    if actor_user_id is not None:
        statement = statement.where(AuditLog.actor_user_id == actor_user_id)
    if action is not None:
        statement = statement.where(AuditLog.action == action)
    statement = statement.order_by(AuditLog.created_at.desc()).offset(skip).limit(safe_limit)

    logs = session.exec(statement).all()
    return _to_audit_log_read_list(session, logs)


def _remove_flagged_content(session: Session, item: ModerationItem) -> None:
    if item.content_type == "comment":
        comment = session.get(Comment, item.content_id)
        if comment and not comment.is_deleted:
            soft_delete_comment(session, comment, CommentDeletedBy.PLATFORM)
        return

    if item.content_type == "post":
        post = session.get(Post, item.content_id)
        if post:
            post.published = False
            post.updated_at = datetime.utcnow()
            session.add(post)
        return

    raise BadRequestError(
        ErrorCode.OPERATION_NOT_ALLOWED,
        "This kind of content cannot be removed automatically.",
    )


def _to_audit_log_read(
    log: AuditLog,
    blog_name: Optional[str] = None,
    resource_label: Optional[str] = None,
) -> AuditLogRead:
    try:
        details = json.loads(log.details) if log.details else {}
    except (TypeError, json.JSONDecodeError):
        details = {}

    return AuditLogRead(
        id=log.id,
        actor_user_id=log.actor_user_id,
        actor_email=log.actor_email,
        actor=log.actor_email,
        action=log.action,
        resource_type=log.resource_type,
        target_type=log.resource_type,
        resource_id=log.resource_id,
        blog_id=log.blog_id,
        blog_name=blog_name,
        resource_label=resource_label,
        details=details,
        description=_describe_audit_log(log, details),
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
    )


# Resource types whose id points at a User row (member-management actions
# record the target member's user id here, same as plain "user" actions).
_USER_RESOURCE_TYPES = {"user", "blog_member"}


def _to_audit_log_read_list(session: Session, logs: List[AuditLog]) -> List[AuditLogRead]:
    """
    Batch-resolves human-readable names for Tenant Scope and Resource so the
    audit log doesn't force superadmins to cross-reference bare ids — one
    query per referenced table instead of a per-row join for each of the
    (possibly 200) rows on the page.
    """
    blog_ids = {log.blog_id for log in logs if log.blog_id is not None}
    blog_ids |= {log.resource_id for log in logs if log.resource_type == "blog" and log.resource_id is not None}
    blog_names: dict[int, str] = {}
    if blog_ids:
        rows = session.exec(select(Blog.id, Blog.name).where(Blog.id.in_(blog_ids))).all()
        blog_names = {bid: name for bid, name in rows}

    user_ids = {log.resource_id for log in logs if log.resource_type in _USER_RESOURCE_TYPES and log.resource_id is not None}
    user_names: dict[int, str] = {}
    if user_ids:
        rows = session.exec(select(User.id, User.first_name, User.last_name).where(User.id.in_(user_ids))).all()
        user_names = {uid: f"{fn} {ln}".strip() for uid, fn, ln in rows}

    post_ids = {log.resource_id for log in logs if log.resource_type == "post" and log.resource_id is not None}
    post_titles: dict[int, str] = {}
    if post_ids:
        rows = session.exec(select(Post.id, Post.title).where(Post.id.in_(post_ids))).all()
        post_titles = {pid: title for pid, title in rows}

    tag_ids = {log.resource_id for log in logs if log.resource_type == "tag" and log.resource_id is not None}
    tag_names: dict[int, str] = {}
    if tag_ids:
        rows = session.exec(select(Tag.id, Tag.name).where(Tag.id.in_(tag_ids))).all()
        tag_names = {tid: name for tid, name in rows}

    ticket_ids = {log.resource_id for log in logs if log.resource_type == "support_ticket" and log.resource_id is not None}
    ticket_subjects: dict[int, str] = {}
    if ticket_ids:
        rows = session.exec(select(SupportTicket.id, SupportTicket.subject).where(SupportTicket.id.in_(ticket_ids))).all()
        ticket_subjects = {tid: subject for tid, subject in rows}

    def resource_label(log: AuditLog) -> Optional[str]:
        if log.resource_id is None:
            return None
        if log.resource_type in _USER_RESOURCE_TYPES:
            return user_names.get(log.resource_id)
        if log.resource_type == "blog":
            return blog_names.get(log.resource_id)
        if log.resource_type == "post":
            return post_titles.get(log.resource_id)
        if log.resource_type == "tag":
            return tag_names.get(log.resource_id)
        if log.resource_type == "support_ticket":
            return ticket_subjects.get(log.resource_id)
        return None

    return [
        _to_audit_log_read(
            log,
            blog_name=blog_names.get(log.blog_id) if log.blog_id is not None else None,
            resource_label=resource_label(log),
        )
        for log in logs
    ]


def _format_datetime_label(value: Any) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
        return parsed.strftime("%b %d, %Y at %I:%M %p UTC")
    except (ValueError, TypeError):
        return None


ROLE_LABELS = {
    "owner": "Owner",
    "editor": "Editor",
    "author": "Author",
    "viewer": "Viewer",
}


def _role_label(role: Any) -> str:
    if isinstance(role, str):
        return ROLE_LABELS.get(role.lower(), role)
    return str(role) if role is not None else "unknown"


def _describe_audit_log(log: AuditLog, details: dict[str, Any]) -> str:
    subject = log.resource_type.replace("_", " ")
    if log.resource_id is not None:
        subject = f"{subject} #{log.resource_id}"
    action_label = log.action.replace(".", " ")

    # Membership actions carry an email (and often a role) — say who, not just "blog member add"
    if log.action == "blog.member_add" and details.get("email"):
        role = details.get("role")
        return f"Added {details['email']} to the workspace" + (f" as {role}" if role else "")

    if log.action == "blog.member_remove" and details.get("email"):
        role = details.get("role")
        return f"Removed {details['email']} from the workspace" + (f" ({role})" if role else "")

    # Posts encode status in the action name itself (post.published, post.draft,
    # post.scheduled) rather than post.created — handle them explicitly before
    # the generic create/update/delete-by-suffix check below.
    if log.resource_type == "post" and details.get("title"):
        title = details["title"]
        if log.action == "post.deleted":
            return f"Deleted post \u201c{title}\u201d"
        if log.action == "post.updated":
            return f"Updated post \u201c{title}\u201d"
        if log.action == "post.published":
            return f"Published post \u201c{title}\u201d"
        if log.action == "post.scheduled":
            when = _format_datetime_label(details.get("published_at"))
            return f"Scheduled post \u201c{title}\u201d" + (f" for {when}" if when else "")
        if log.action == "post.draft":
            return f"Saved post \u201c{title}\u201d as a draft"

    # --- Comment Actions ---
    # Comments use "post_title" rather than "title" so they don't get swept
    # into the post-specific branch above. Readers must register to comment
    # on the public blog, so most comment.create rows are ordinary readers,
    # not workspace team members — call that out when it's a team member,
    # since that's the more notable case to a platform admin reviewing activity.
    if log.resource_type == "comment":
        post_title = details.get("post_title")
        on_post = f' on "{post_title}"' if post_title else (f" on post #{details['post_id']}" if details.get("post_id") else "")

        if log.action in ("comment.create", "comment.created"):
            role = details.get("commenter_role")
            if role and role != "reader":
                return f"Commented{on_post} (as {_role_label(role)})"
            return f"A reader commented{on_post}"

        if log.action in ("comment.update", "comment.updated"):
            return f"Edited a comment{on_post}"

        if log.action in ("comment.delete", "comment.deleted", "comment.moderator_delete"):
            deleted_by = details.get("deleted_by")
            if log.action == "comment.moderator_delete" or deleted_by == "moderator":
                return f"Removed a comment{on_post} (moderator)"
            return f"Deleted a comment{on_post}"

    # Named create/update/delete resources (posts, tags, comments, support tickets, etc.)
    # — use the name/title/subject instead of a bare resource id.
    name = details.get("name") or details.get("title") or details.get("subject")
    if name:
        if log.action.endswith((".create", ".created")):
            return f"Created {log.resource_type.replace('_', ' ')} \u201c{name}\u201d"
        if log.action.endswith((".update", ".updated")):
            return f"Updated {log.resource_type.replace('_', ' ')} \u201c{name}\u201d"
        if log.action.endswith((".delete", ".deleted")):
            return f"Deleted {log.resource_type.replace('_', ' ')} \u201c{name}\u201d"

    # Simple before/after toggle (e.g. status flips): {"from": ..., "to": ...}
    if "from" in details and "to" in details:
        return f"{action_label} on {subject}: {details['from']} \u2192 {details['to']}"

    # Multi-field diffs (e.g. blog.update, settings.updated): {"changes": {field: {"from", "to"}}}
    changes = details.get("changes")
    if changes:
        parts = [f"{field} {c.get('from')} \u2192 {c.get('to')}" for field, c in changes.items()]
        return f"{action_label} on {subject}: {'; '.join(parts)}"

    fields = details.get("fields")
    if fields:
        return f"{action_label} on {subject}: {', '.join(fields)}"
    return f"{action_label} on {subject}"


# ============================================================================
# SUPPORT TICKET ENDPOINTS
# ============================================================================

@router.get("/support", response_model=List[SupportTicketRead])
def list_all_tickets(
    ticket_status: Optional[TicketStatus] = None,
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    query = select(SupportTicket).order_by(SupportTicket.updated_at.desc())
    if ticket_status:
        query = query.where(SupportTicket.status == ticket_status)
    tickets = session.exec(query).all()

    blog_ids = {t.blog_id for t in tickets if t.blog_id is not None}
    blog_names: dict[int, str] = {}
    if blog_ids:
        rows = session.exec(select(Blog.id, Blog.name).where(Blog.id.in_(blog_ids))).all()
        blog_names = {bid: name for bid, name in rows}

    user_ids = {t.user_id for t in tickets}
    user_names: dict[int, str] = {}
    if user_ids:
        rows = session.exec(
            select(User.id, User.first_name, User.last_name, User.email).where(User.id.in_(user_ids))
        ).all()
        for uid, first_name, last_name, email in rows:
            full_name = " ".join(part for part in (first_name, last_name) if part)
            user_names[uid] = full_name or email

    return [
        SupportTicketRead.model_validate(t).model_copy(
            update={"blog_name": blog_names.get(t.blog_id), "user_name": user_names.get(t.user_id)}
        )
        for t in tickets
    ]


@router.patch("/support/{ticket_id}/status", response_model=SupportTicketRead)
def update_ticket_status(
    ticket_id: int,
    payload: UpdateTicketStatusSchema,
    request: Request,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket:
        raise NotFoundError(ErrorCode.TICKET_NOT_FOUND)

    old_status = ticket.status
    ticket.status = payload.status
    session.add(ticket)

    add_audit_log(
        session,
        action="support.status_updated",
        resource_type="support_ticket",
        resource_id=ticket.id,
        actor=current_user,
        details={"from": old_status.value, "to": payload.status.value},
        request=request,
    )

    if payload.status != old_status:
        add_notification(
            session,
            user_id=ticket.user_id,
            type="support_ticket_status_changed",
            title="Your support ticket status changed",
            body=f'"{ticket.subject}" is now {payload.status.value.replace("_", " ")}',
            link=f"/admin/support-tickets?ticket={ticket.id}",
        )

    session.commit()
    session.refresh(ticket)
    return ticket