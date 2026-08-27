import json
import os
from datetime import datetime
from typing import Any, Dict

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.config import settings
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, BadRequestError, ExternalServiceError
from app.core.logging_config import get_logger
from app.core.permissions import get_public_blog, require_blog_owner, require_completed_onboarding
from app.core.security import get_current_user
from app.models import SiteSettings, User, Blog
from app.schemas import (
    AboutPageSettings,
    AboutPageSettingsResponse,
    AllSiteSettings,
    BrandingSettings,
    BrandingSettingsResponse,
    ContactSettings,
    ContactSettingsResponse,
    FooterSettings,
    FooterSettingsResponse,
    GeneralSettings,
    GeneralSettingsResponse,
    SEOSettings,
    SEOSettingsResponse,
)

load_dotenv()

logger = get_logger("settings")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

router = APIRouter(prefix="/blogs/{blog_id}/settings", tags=["Settings"])


def get_setting(session: Session, blog_id: int, key: str, default_model: Any) -> Dict:
    statement = select(SiteSettings).where(SiteSettings.setting_key == key, SiteSettings.blog_id == blog_id)
    setting = session.exec(statement).first()

    if not setting:
        return default_model().model_dump()

    try:
        return default_model.model_validate(json.loads(setting.setting_value)).model_dump()
    except Exception:
        # Stored settings predate the current schema, or the row is corrupt.
        # Falling back to defaults keeps the page usable; the reason is logged
        # rather than surfaced, since the visitor can't act on it.
        logger.warning(
            "Falling back to defaults for setting %r on blog %s", key, blog_id, exc_info=True
        )
        return default_model().model_dump()


def _diff_fields(old_values: Dict, new_values: Dict) -> Dict[str, Dict[str, Any]]:
    """
    Compare old vs new settings values and return only the fields that
    actually changed, each as {"from": ..., "to": ...}. Keeps audit log
    details compact and genuinely useful instead of just listing field names.
    """
    changes: Dict[str, Dict[str, Any]] = {}
    for key, new_value in new_values.items():
        old_value = old_values.get(key)
        if old_value != new_value:
            changes[key] = {"from": old_value, "to": new_value}
    return changes


def update_setting(
    session: Session,
    blog_id: int,
    key: str,
    value_model: Any,
    actor: User,
    request: Request | None = None,
) -> Dict:
    statement = select(SiteSettings).where(SiteSettings.setting_key == key, SiteSettings.blog_id == blog_id)
    existing = session.exec(statement).first()

    # Capture the previous values BEFORE we overwrite them, so the audit log
    # can show what actually changed rather than just which keys were touched.
    if existing:
        try:
            old_values = json.loads(existing.setting_value)
        except (json.JSONDecodeError, TypeError):
            old_values = {}
    else:
        old_values = {}

    settings_json = json.dumps(value_model.model_dump())

    if existing:
        existing.setting_value = settings_json
        existing.updated_at = datetime.utcnow()
        session.add(existing)
    else:
        session.add(
            SiteSettings(
                setting_key=key,
                setting_value=settings_json,
                blog_id=blog_id,
                updated_at=datetime.utcnow(),
            )
        )

    values = value_model.model_dump()
    changes = _diff_fields(old_values, values)
    add_audit_log(
        session,
        action="branding.updated" if key == "branding" else "settings.updated",
        resource_type="settings",
        blog_id=blog_id,
        actor=actor,
        details={"key": key, "changes": changes} if changes else {"key": key, "fields": []},
        request=request,
    )
    session.commit()
    return values


def upload_branding_asset(file: UploadFile, folder: str, allowed_types: tuple[str, ...]) -> Dict[str, str]:
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        raise BadRequestError(
            ErrorCode.INVALID_FILE_TYPE,
            "Please upload a PNG, JPEG, WebP, or SVG image.",
        )
    if file.size and file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise BadRequestError(
            ErrorCode.FILE_TOO_LARGE,
            f"Please choose an image under {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    try:
        result = cloudinary.uploader.upload(file.file, folder=folder, resource_type="image")
    except Exception as exc:
        raise ExternalServiceError(
            ErrorCode.UPLOAD_FAILED,
            log_message=f"cloudinary upload failed for {folder}: {type(exc).__name__}: {exc}",
        ) from exc
    return {"url": result.get("secure_url")}


@router.get("/general", response_model=GeneralSettingsResponse)
def get_general_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "general", GeneralSettings)


@router.post("/general", response_model=GeneralSettingsResponse)
def update_general_settings(
    blog_id: int,
    settings: GeneralSettings,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "general", settings, current_user, request=request)


@router.get("/about", response_model=AboutPageSettingsResponse)
def get_about_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "about_page", AboutPageSettings)


@router.post("/about", response_model=AboutPageSettingsResponse)
def update_about_settings(
    blog_id: int,
    settings: AboutPageSettings,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "about_page", settings, current_user, request=request)


@router.get("/footer", response_model=FooterSettingsResponse)
def get_footer_settings(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
):
    statement = select(SiteSettings).where(
        SiteSettings.setting_key == "footer",
        SiteSettings.blog_id == blog_id,
    )
    setting = session.exec(statement).first()

    if setting:
        try:
            data = FooterSettings.model_validate(json.loads(setting.setting_value))
            return data.model_dump()
        except Exception:
            logger.warning(
                "Stored footer settings for blog %s are unreadable; using defaults",
                blog_id,
                exc_info=True,
            )

    # No saved footer yet — hydrate sensible defaults from the blog model
    # so the user sees their own tagline and blog name instead of generic placeholders
    defaults = FooterSettings(
        footer_text=blog.tagline or f"Thoughts and ideas from {blog.name}.",
        copyright_text=f"© {{year}} {blog.name}. Powered by INKO.",
    )
    return defaults.model_dump()


@router.post("/footer", response_model=FooterSettingsResponse)
def update_footer_settings(
    blog_id: int,
    settings: FooterSettings,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    from app.models import BlogSubscription, SubscriptionPlan
    
    # Check if user is trying to modify the copyright text
    existing_settings = get_setting(session, blog_id, "footer", FooterSettings)
    
    if settings.copyright_text != existing_settings.get("copyright_text"):
        # Check subscription plan - only pro/team can edit copyright
        subscription = session.exec(
            select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)
        ).first()
        
        plan = subscription.plan if subscription else SubscriptionPlan.FREE
        
        if plan == SubscriptionPlan.FREE:
            raise AuthorizationError(
                ErrorCode.PLAN_UPGRADE_REQUIRED,
                "Editing the copyright text is available on the Pro and Team plans. "
                "Upgrade to remove the INKO attribution.",
            )
    
    return update_setting(session, blog_id, "footer", settings, current_user, request=request)


@router.get("/branding", response_model=BrandingSettingsResponse)
def get_branding_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "branding", BrandingSettings)


@router.post("/branding", response_model=BrandingSettingsResponse)
def update_branding_settings(
    blog_id: int,
    settings: BrandingSettings,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "branding", settings, current_user, request=request)


@router.post("/branding/upload-logo")
def upload_logo(
    blog_id: int,
    file: UploadFile = File(...),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return upload_branding_asset(
        file,
        folder="branding/logos",
        allowed_types=("image/png", "image/jpeg", "image/webp", "image/svg+xml"),
    )


@router.post("/branding/upload-favicon")
def upload_favicon(
    blog_id: int,
    file: UploadFile = File(...),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return upload_branding_asset(
        file,
        folder="branding/favicons",
        allowed_types=("image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"),
    )


@router.get("/seo", response_model=SEOSettingsResponse)
def get_seo_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "seo", SEOSettings)


@router.post("/seo", response_model=SEOSettingsResponse)
def update_seo_settings(
    blog_id: int,
    settings: SEOSettings,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "seo", settings, current_user, request=request)


@router.get("/contact", response_model=ContactSettingsResponse)
def get_contact_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "contact", ContactSettings)


@router.post("/contact", response_model=ContactSettingsResponse)
def update_contact_settings(
    blog_id: int,
    settings: ContactSettings,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "contact", settings, current_user, request=request)


@router.get("/all", response_model=AllSiteSettings)
def get_all_settings(
    blog_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    # This aggregate endpoint is only meant for the admin settings dashboard,
    # unlike the per-section GETs below (which stay public since the live
    # blog site needs them to render footer/SEO/branding/about/contact for
    # anonymous visitors). require_blog_owner (via get_current_blog) already
    # validates blog_id + membership/superadmin, so no separate blog dep needed here.
    return AllSiteSettings(
        general=get_setting(session, blog_id, "general", GeneralSettings),
        about=get_setting(session, blog_id, "about_page", AboutPageSettings),
        footer=get_setting(session, blog_id, "footer", FooterSettings),
        branding=get_setting(session, blog_id, "branding", BrandingSettings),
        seo=get_setting(session, blog_id, "seo", SEOSettings),
        contact=get_setting(session, blog_id, "contact", ContactSettings),
    )