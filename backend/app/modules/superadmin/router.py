import json
from typing import Any, List, Optional
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlmodel import Session, select
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.moderation import record_moderation_action
from app.core.permissions import require_super_admin
from app.core.security import get_current_user
from app.models import AuditLog, Blog, User, Post, Comment, ModerationItem, BlogMember, PlatformSettings as PlatformSettingsRecord
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
    SubscriptionRead,
    UserRead,
    SuperadminUserQueryParams,
)

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

# Response models for superadmin endpoints
class UserSuspendUpdate(BaseModel):
    is_active: bool

class BlogToggleActive(BaseModel):
    is_active: bool


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

@router.patch("/blogs/{blog_id}", response_model=BlogAnalytics)
def update_blog_status(
    blog_id: int,
    data: BlogToggleActive,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Toggle a blog's active status."""
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")
    
    blog.is_active = data.is_active
    session.add(blog)
    add_audit_log(
        session,
        action="superadmin.blog_status_update",
        resource_type="blog",
        resource_id=blog.id,
        blog_id=blog.id,
        actor=current_user,
        details={"is_active": blog.is_active},
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
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently delete a blog and all its content."""
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")
    
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
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Suspend or activate a user account safely."""
    # FIX: Eagerly load relationship so the UserRead response schema receives its expected blog_memberships list
    statement = select(User).where(User.id == user_id).options(selectinload(User.blog_memberships))
    user = session.exec(statement).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user.is_active = data.is_active
    session.add(user)
    
    add_audit_log(
        session,
        action="superadmin.user_status_update",
        resource_type="user",
        resource_id=user.id,
        actor=current_user,
        details={"is_active": user.is_active},
    )
    session.commit()
    session.refresh(user)
    
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def superadmin_delete_user(
    user_id: int,
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Permanently (or softly) delete a user account by superadmin."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    # Prevent deleting the last superadmin
    if user.is_super_admin:
        remaining_superadmins = session.exec(
            select(User).where(
                User.is_super_admin == True,
                User.id != user.id
            )
        ).all()
        if len(remaining_superadmins) <= 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last super admin account"
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
        }
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
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update platform settings."""
    current = _load_platform_settings(session)
    merged = _apply_compatibility_projection(_deep_merge(
        current.model_dump(mode="json"),
        data.model_dump(exclude_unset=True, mode="json"),
    ))
    saved = _save_platform_settings(session, PlatformSettings.model_validate(merged))
    add_audit_log(
        session,
        action="superadmin.platform_settings_update",
        resource_type="platform_settings",
        actor=current_user,
        details={"fields": sorted(data.model_dump(exclude_unset=True).keys())},
    )
    session.commit()
    return PlatformSettingsResponse.model_validate(saved)


# ============================================================================
# SUBSCRIPTIONS ENDPOINTS
# ============================================================================

@router.get("/subscriptions", response_model=List[SubscriptionRead])
def get_all_subscriptions(
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """Get all blog subscriptions."""
    from app.models.blog import BlogSubscription
    subscriptions = session.exec(select(BlogSubscription)).all()
    return subscriptions


@router.get("/subscriptions/{blog_id}", response_model=SubscriptionRead)
def get_blog_subscription(
    blog_id: int,
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """Get subscription for a specific blog."""
    from app.models.blog import BlogSubscription
    subscription = session.exec(
        select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)
    ).first()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )
    
    return subscription


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
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Persist a moderation decision and apply content changes when needed."""
    action = payload.action.lower()
    if action not in {"approve", "reject", "remove"}:
        raise HTTPException(status_code=400, detail="Action must be approve, reject, or remove")

    item = session.get(ModerationItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Moderation item not found")

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
    statement = select(AuditLog)
    if blog_id is not None:
        statement = statement.where(AuditLog.blog_id == blog_id)
    if actor_user_id is not None:
        statement = statement.where(AuditLog.actor_user_id == actor_user_id)
    if action is not None:
        statement = statement.where(AuditLog.action == action)
    statement = statement.order_by(AuditLog.created_at.desc()).offset(skip).limit(safe_limit)

    logs = session.exec(statement).all()
    return [_to_audit_log_read(log) for log in logs]


def _remove_flagged_content(session: Session, item: ModerationItem) -> None:
    if item.content_type == "comment":
        comment = session.get(Comment, item.content_id)
        if comment:
            comment.content = "[This comment has been removed by a moderator]"
            comment.is_deleted = True
            comment.updated_at = datetime.utcnow()
            session.add(comment)
        return

    if item.content_type == "post":
        post = session.get(Post, item.content_id)
        if post:
            post.published = False
            post.updated_at = datetime.utcnow()
            session.add(post)
        return

    raise HTTPException(status_code=400, detail="Unsupported moderation item type")


def _to_audit_log_read(log: AuditLog) -> AuditLogRead:
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
        details=details,
        description=_describe_audit_log(log, details),
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
    )


def _describe_audit_log(log: AuditLog, details: dict[str, Any]) -> str:
    subject = log.resource_type.replace("_", " ")
    if log.resource_id is not None:
        subject = f"{subject} #{log.resource_id}"
    fields = details.get("fields")
    if fields:
        return f"{log.action.replace('.', ' ')} on {subject}: {', '.join(fields)}"
    return f"{log.action.replace('.', ' ')} on {subject}"
