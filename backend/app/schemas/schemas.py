from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

    class Config:
        from_attributes = True

# Tag Schemas
class TagCreate(BaseModel):
    name: str

class TagRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class PopularTagRead(TagRead):
    count: int

class TagUpdate(BaseModel):
    name: Optional[str] = None

    class Config:
        from_attributes = True

class MetadataRead(BaseModel):
    repo_url: Optional[str] = None
    live_url: Optional[str] = None

    class Config:
        from_attributes = True

# Comment Schemas
class CommentRead(BaseModel):
    id: int
    content: str
    user_id: int
    post_id: int
    parent_id: Optional[int]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    user: UserRead
    replies: List["CommentRead"] = Field(default_factory=list)
    
    @field_validator("replies", mode="before")
    @classmethod
    def ensure_replies_list(cls, v):
        return v if isinstance(v, list) else []

    model_config = {"from_attributes": True}

class CommentAdminRead(CommentRead):
    post: "PostShort"  

class CommentCreate(BaseModel):
    content: str
    post_id: int
    parent_id: Optional[int] = None


# Post Schemas
class PostCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    content: str
    thumbnail_url: Optional[str] = None
    is_project: bool = False
    published: bool = True
    tag_ids: List[int] = Field(default_factory=list)

class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_project: Optional[bool] = None
    published: Optional[bool] = None
    tag_ids: Optional[List[int]] = None

class PostRead(BaseModel):
    id: int
    title: str
    slug: str
    content: str
    author_id: Optional[int] = None
    author: Optional[UserRead] = None
    thumbnail_url: Optional[str] = None
    views: int
    is_project: bool
    published: bool
    created_at: datetime
    updated_at: datetime
    tags: List[TagRead] = Field(default_factory=list)
    project_metadata: Optional[MetadataRead] = None
    comments: List[CommentRead] = Field(default_factory=list)

    class Config:
        from_attributes = True

class PostShort(BaseModel):
    id: int
    title: str
    class Config:
        from_attributes = True


# ============================================================================
# ✅ ADVANCED CMS SETTINGS - PHASE 2
# ============================================================================

# Social Links (shared across About and Footer)
class SocialLinks(BaseModel):
    github: Optional[str] = None
    twitter: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    facebook: Optional[str] = None

# 1. General Site Settings
class GeneralSettings(BaseModel):
    """General site-wide settings"""
    site_name: str = "Inko"
    site_tagline: str = "Your ideas, amplified"
    site_description: str = "A modern blog CMS for sharing your stories and ideas"
    timezone: str = "UTC"
    language: str = "en"
    posts_per_page: int = 10

class GeneralSettingsResponse(GeneralSettings):
    class Config:
        from_attributes = True

# 2. About Page Settings (already exists, kept for completeness)
class AboutPageSettings(BaseModel):
    bio_title: str = "Welcome to My Blog"
    bio_subtitle: str = "Sharing ideas, stories, and insights"
    bio_content: str = "This is a modern blog CMS. Customize this in your admin panel."
    show_stats: bool = True
    show_contact_cta: bool = True
    email: Optional[str] = None
    social_links: SocialLinks = Field(default_factory=SocialLinks)

class AboutPageSettingsResponse(AboutPageSettings):
    class Config:
        from_attributes = True

# 3. Footer Settings
class FooterSettings(BaseModel):
    """Footer customization settings"""
    footer_text: str = "Your ideas, amplified."
    show_newsletter: bool = True
    newsletter_title: str = "Newsletter"
    newsletter_description: str = "Get the latest posts delivered to your inbox."
    show_social_links: bool = True
    social_links: SocialLinks = Field(default_factory=SocialLinks)
    copyright_text: str = "© {year} Inko. All rights reserved."
    show_quick_links: bool = True
    show_categories: bool = True

class FooterSettingsResponse(FooterSettings):
    class Config:
        from_attributes = True

# 4. Branding Settings
class BrandingSettings(BaseModel):
    """Theme and branding settings"""
    primary_color: str = "#4F46E5"  # Indigo
    secondary_color: str = "#7C3AED"  # Purple
    accent_color: str = "#EC4899"  # Pink
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    font_heading: str = "Inter"
    font_body: str = "Inter"

class BrandingSettingsResponse(BrandingSettings):
    class Config:
        from_attributes = True

# 5. SEO Settings
class SEOSettings(BaseModel):
    """SEO and analytics settings"""
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    google_analytics_id: Optional[str] = None
    google_site_verification: Optional[str] = None
    og_image: Optional[str] = None
    twitter_handle: Optional[str] = None

class SEOSettingsResponse(SEOSettings):
    class Config:
        from_attributes = True

class FAQItem(BaseModel):
    """Reusable FAQ item for Contact page"""
    question: str
    answer: str

class ContactSettings(BaseModel):
    """Contact page and form settings - fully editable from Admin Studio"""
    contact_email: EmailStr = "hello@inko.blog"
    location: str = "San Francisco, CA"
    response_time: str = "Usually within 24-48 hours"
    phone: Optional[str] = None
    show_social_links: bool = True
    social_links: SocialLinks = Field(default_factory=SocialLinks)
    show_faq: bool = True
    faqs: List[FAQItem] = Field(
        default_factory=lambda: [
            FAQItem(
                question="💼 Open for freelance?",
                answer="Yes, currently accepting select projects.",
            ),
            FAQItem(
                question="🎤 Speaking engagements?",
                answer="Always interested in tech conferences and meetups.",
            ),
            FAQItem(
                question="✍️ Guest posting?",
                answer="Open to high-quality technical content collaborations.",
            ),
        ]
    )

class ContactSettingsResponse(ContactSettings):
    class Config:
        from_attributes = True

# Combined Settings Response (for frontend to fetch all at once)
class AllSiteSettings(BaseModel):
    """All site settings combined"""
    general: GeneralSettings
    about: AboutPageSettings
    footer: FooterSettings
    branding: BrandingSettings
    seo: SEOSettings
    contact: ContactSettings

    class Config:
        from_attributes = True


# Rebuild Schemas
CommentRead.model_rebuild()
PostRead.model_rebuild()
