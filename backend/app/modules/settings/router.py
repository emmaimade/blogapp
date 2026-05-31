import json
import os
from datetime import datetime
from typing import Any, Dict

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.permissions import get_public_blog, require_blog_owner, require_completed_onboarding
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
    except (json.JSONDecodeError, Exception):
        return default_model().model_dump()


def update_setting(session: Session, blog_id: int, key: str, value_model: Any) -> Dict:
    statement = select(SiteSettings).where(SiteSettings.setting_key == key, SiteSettings.blog_id == blog_id)
    existing = session.exec(statement).first()

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

    session.commit()
    return value_model.model_dump()


def upload_branding_asset(file: UploadFile, folder: str, allowed_types: tuple[str, ...]) -> Dict[str, str]:
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    result = cloudinary.uploader.upload(file.file, folder=folder, resource_type="image")
    return {"url": result.get("secure_url")}


@router.get("/general", response_model=GeneralSettingsResponse)
def get_general_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "general", GeneralSettings)


@router.post("/general", response_model=GeneralSettingsResponse)
def update_general_settings(
    blog_id: int,
    settings: GeneralSettings,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "general", settings)


@router.get("/about", response_model=AboutPageSettingsResponse)
def get_about_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "about_page", AboutPageSettings)


@router.post("/about", response_model=AboutPageSettingsResponse)
def update_about_settings(
    blog_id: int,
    settings: AboutPageSettings,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "about_page", settings)


@router.get("/footer", response_model=FooterSettingsResponse)
def get_footer_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "footer", FooterSettings)


@router.post("/footer", response_model=FooterSettingsResponse)
def update_footer_settings(
    blog_id: int,
    settings: FooterSettings,
    session: Session = Depends(get_session),
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Editing the copyright text is only available for Pro and Team plans. Please upgrade to remove the INKO attribution."
            )
    
    return update_setting(session, blog_id, "footer", settings)


@router.get("/branding", response_model=BrandingSettingsResponse)
def get_branding_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "branding", BrandingSettings)


@router.post("/branding", response_model=BrandingSettingsResponse)
def update_branding_settings(
    blog_id: int,
    settings: BrandingSettings,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "branding", settings)


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
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "seo", settings)


@router.get("/contact", response_model=ContactSettingsResponse)
def get_contact_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return get_setting(session, blog_id, "contact", ContactSettings)


@router.post("/contact", response_model=ContactSettingsResponse)
def update_contact_settings(
    blog_id: int,
    settings: ContactSettings,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return update_setting(session, blog_id, "contact", settings)


@router.get("/all", response_model=AllSiteSettings)
def get_all_settings(blog_id: int, session: Session = Depends(get_session), blog: Blog = Depends(get_public_blog)):
    return AllSiteSettings(
        general=get_setting(session, blog_id, "general", GeneralSettings),
        about=get_setting(session, blog_id, "about_page", AboutPageSettings),
        footer=get_setting(session, blog_id, "footer", FooterSettings),
        branding=get_setting(session, blog_id, "branding", BrandingSettings),
        seo=get_setting(session, blog_id, "seo", SEOSettings),
        contact=get_setting(session, blog_id, "contact", ContactSettings),
    )
