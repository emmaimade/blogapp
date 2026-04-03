import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from app.dbConfig import get_session
from app.models import SiteSettings, User
from app.schemas.schemas import (
    GeneralSettings, GeneralSettingsResponse,
    AboutPageSettings, AboutPageSettingsResponse,
    FooterSettings, FooterSettingsResponse,
    BrandingSettings, BrandingSettingsResponse,
    SEOSettings, SEOSettingsResponse,
    ContactSettings, ContactSettingsResponse,
    AllSiteSettings
)
from app.utils.auth import admin_only
import json
from datetime import datetime
from typing import Dict, Any

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

router = APIRouter(prefix="/settings", tags=["Settings"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_setting(session: Session, key: str, default_model: Any) -> Dict:
    """Get a setting by key, return defaults if not found"""
    statement = select(SiteSettings).where(SiteSettings.setting_key == key)
    setting = session.exec(statement).first()
    
    if not setting:
        return default_model().model_dump()
    
    try:
        return default_model.model_validate(json.loads(setting.setting_value)).model_dump()
    except json.JSONDecodeError:
        return default_model().model_dump()
    except Exception:
        return default_model().model_dump()


def update_setting(session: Session, key: str, value_model: Any) -> Dict:
    """Update or create a setting"""
    statement = select(SiteSettings).where(SiteSettings.setting_key == key)
    existing = session.exec(statement).first()
    
    settings_json = json.dumps(value_model.model_dump())
    
    if existing:
        existing.setting_value = settings_json
        existing.updated_at = datetime.utcnow()
        session.add(existing)
    else:
        new_setting = SiteSettings(
            setting_key=key,
            setting_value=settings_json,
            updated_at=datetime.utcnow()
        )
        session.add(new_setting)
    
    session.commit()
    return value_model.model_dump()


def upload_branding_asset(file: UploadFile, folder: str, allowed_types: tuple[str, ...]) -> Dict[str, str]:
    """Upload branding assets to Cloudinary with basic content-type validation."""
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    result = cloudinary.uploader.upload(file.file, folder=folder, resource_type="image")
    return {"url": result.get("secure_url")}


# ============================================================================
# 1. GENERAL SETTINGS
# ============================================================================

@router.get("/general", response_model=GeneralSettingsResponse)
def get_general_settings(session: Session = Depends(get_session)):
    """Get general site settings (public)"""
    return get_setting(session, "general", GeneralSettings)


@router.post("/general", response_model=GeneralSettingsResponse)
def update_general_settings(
    settings: GeneralSettings,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update general site settings (admin only)"""
    return update_setting(session, "general", settings)


# ============================================================================
# 2. ABOUT PAGE SETTINGS
# ============================================================================

@router.get("/about", response_model=AboutPageSettingsResponse)
def get_about_settings(session: Session = Depends(get_session)):
    """Get About page settings (public)"""
    return get_setting(session, "about_page", AboutPageSettings)


@router.post("/about", response_model=AboutPageSettingsResponse)
def update_about_settings(
    settings: AboutPageSettings,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update About page settings (admin only)"""
    return update_setting(session, "about_page", settings)


# ============================================================================
# 3. FOOTER SETTINGS
# ============================================================================

@router.get("/footer", response_model=FooterSettingsResponse)
def get_footer_settings(session: Session = Depends(get_session)):
    """Get footer settings (public)"""
    return get_setting(session, "footer", FooterSettings)


@router.post("/footer", response_model=FooterSettingsResponse)
def update_footer_settings(
    settings: FooterSettings,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update footer settings (admin only)"""
    return update_setting(session, "footer", settings)


# ============================================================================
# 4. BRANDING SETTINGS
# ============================================================================

@router.get("/branding", response_model=BrandingSettingsResponse)
def get_branding_settings(session: Session = Depends(get_session)):
    """Get branding settings (public)"""
    return get_setting(session, "branding", BrandingSettings)


@router.post("/branding", response_model=BrandingSettingsResponse)
def update_branding_settings(
    settings: BrandingSettings,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update branding settings (admin only)"""
    return update_setting(session, "branding", settings)


@router.post("/branding/upload-logo")
def upload_logo(
    file: UploadFile = File(...),
    current_admin: User = Depends(admin_only)
):
    """Upload a logo asset for branding settings."""
    return upload_branding_asset(
        file,
        folder="branding/logos",
        allowed_types=("image/png", "image/jpeg", "image/webp", "image/svg+xml")
    )


@router.post("/branding/upload-favicon")
def upload_favicon(
    file: UploadFile = File(...),
    current_admin: User = Depends(admin_only)
):
    """Upload a favicon asset for branding settings."""
    return upload_branding_asset(
        file,
        folder="branding/favicons",
        allowed_types=("image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon")
    )


# ============================================================================
# 5. SEO SETTINGS
# ============================================================================

@router.get("/seo", response_model=SEOSettingsResponse)
def get_seo_settings(session: Session = Depends(get_session)):
    """Get SEO settings (public)"""
    return get_setting(session, "seo", SEOSettings)


@router.post("/seo", response_model=SEOSettingsResponse)
def update_seo_settings(
    settings: SEOSettings,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update SEO settings (admin only)"""
    return update_setting(session, "seo", settings)


# ============================================================================
# 6. CONTACT SETTINGS (New)
# ============================================================================

@router.get("/contact", response_model=ContactSettingsResponse)
def get_contact_settings(session: Session = Depends(get_session)):
    """Get contact page settings (public)"""
    return get_setting(session, "contact", ContactSettings)


@router.post("/contact", response_model=ContactSettingsResponse)
def update_contact_settings(
    settings: ContactSettings,
    session: Session = Depends(get_session),
    current_admin: User = Depends(admin_only)
):
    """Update contact page settings (admin only)"""
    return update_setting(session, "contact", settings)


# ============================================================================
# 7. ALL SETTINGS (CONVENIENCE ENDPOINT)
# ============================================================================

@router.get("/all", response_model=AllSiteSettings)
def get_all_settings(session: Session = Depends(get_session)):
    """
    Get all site settings in one request (public)
    Useful for frontend to fetch everything at once
    """
    return AllSiteSettings(
        general=get_setting(session, "general", GeneralSettings),
        about=get_setting(session, "about_page", AboutPageSettings),
        footer=get_setting(session, "footer", FooterSettings),
        branding=get_setting(session, "branding", BrandingSettings),
        seo=get_setting(session, "seo", SEOSettings),
        contact=get_setting(session, "contact", ContactSettings)
    )
