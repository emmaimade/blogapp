from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class SocialLinks(BaseModel):
    github: Optional[str] = None
    twitter: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    facebook: Optional[str] = None


class GeneralSettings(BaseModel):
    site_name: str = "Inko"
    site_tagline: str = "Your ideas, amplified"
    site_description: str = "A modern blog CMS for sharing your stories and ideas"
    timezone: str = "UTC"
    language: str = "en"
    posts_per_page: int = 10


class GeneralSettingsResponse(GeneralSettings):
    class Config:
        from_attributes = True


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


class FooterSettings(BaseModel):
    footer_text: str = "Your ideas, amplified."
    show_newsletter: bool = True
    newsletter_title: str = "Newsletter"
    newsletter_description: str = "Get the latest posts delivered to your inbox."
    show_social_links: bool = True
    social_links: SocialLinks = Field(default_factory=SocialLinks)
    copyright_text: str = "Powered by INKO"
    show_quick_links: bool = True
    show_categories: bool = True


class FooterSettingsResponse(FooterSettings):
    class Config:
        from_attributes = True


class BrandingSettings(BaseModel):
    primary_color: str = "#9333EA"
    secondary_color: str = "#18181B"
    accent_color: str = "#A855F7"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    font_heading: str = "Inter"
    font_body: str = "Inter"


class BrandingSettingsResponse(BrandingSettings):
    class Config:
        from_attributes = True


class SEOSettings(BaseModel):
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
    question: str
    answer: str


class ContactSettings(BaseModel):
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
                question="Open for freelance?",
                answer="Yes, currently accepting select projects.",
            ),
            FAQItem(
                question="Speaking engagements?",
                answer="Always interested in tech conferences and meetups.",
            ),
            FAQItem(
                question="Guest posting?",
                answer="Open to high-quality technical content collaborations.",
            ),
        ]
    )


class ContactSettingsResponse(ContactSettings):
    class Config:
        from_attributes = True


class AllSiteSettings(BaseModel):
    general: GeneralSettings
    about: AboutPageSettings
    footer: FooterSettings
    branding: BrandingSettings
    seo: SEOSettings
    contact: ContactSettings

    class Config:
        from_attributes = True


class PlatformFeatureFlags(BaseModel):
    custom_domains: bool = True
    api_access: bool = True
    analytics: bool = True
    sso: bool = False
    comments: bool = True
    newsletters: bool = False


class PlatformPlanFeatures(BaseModel):
    custom_domains: bool = False
    api_access: bool = False
    analytics: bool = False
    sso: bool = False
    comments: bool = True
    newsletters: bool = False


class PlatformPlanConfig(BaseModel):
    max_blogs_per_user: int = 5
    max_members_per_blog: int = 20
    features: PlatformPlanFeatures = Field(default_factory=PlatformPlanFeatures)


class PlatformPlanSettings(BaseModel):
    free: PlatformPlanConfig = Field(default_factory=PlatformPlanConfig)
    pro: PlatformPlanConfig = Field(
        default_factory=lambda: PlatformPlanConfig(
            max_blogs_per_user=25,
            max_members_per_blog=50,
            features=PlatformPlanFeatures(
                custom_domains=True,
                api_access=True,
                analytics=True,
                comments=True,
                newsletters=True,
            ),
        )
    )
    team: PlatformPlanConfig = Field(
        default_factory=lambda: PlatformPlanConfig(
            max_blogs_per_user=100,
            max_members_per_blog=250,
            features=PlatformPlanFeatures(
                custom_domains=True,
                api_access=True,
                analytics=True,
                sso=True,
                comments=True,
                newsletters=True,
            ),
        )
    )


class PlatformSettings(BaseModel):
    platform_name: str = "INKO"
    platform_url: str = "https://inko.blog"
    support_email: EmailStr = "support@inko.blog"
    max_blogs_per_user: int = 5
    max_members_per_blog: int = 20
    allow_public_signup: bool = True
    require_email_verification: bool = True
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_from: EmailStr = "noreply@inko.blog"
    enable_google_auth: bool = True
    enable_github_auth: bool = False
    session_timeout_hours: int = 24
    enforce_2fa_superadmin: bool = True
    feature_custom_domains: bool = True
    feature_api_access: bool = True
    feature_analytics: bool = True
    feature_sso: bool = False
    feature_comments: bool = True
    feature_newsletters: bool = False
    feature_flags: PlatformFeatureFlags = Field(default_factory=PlatformFeatureFlags)
    plans: PlatformPlanSettings = Field(default_factory=PlatformPlanSettings)

    class Config:
        from_attributes = True


class PlatformSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    platform_url: Optional[str] = None
    support_email: Optional[EmailStr] = None
    max_blogs_per_user: Optional[int] = None
    max_members_per_blog: Optional[int] = None
    allow_public_signup: Optional[bool] = None
    require_email_verification: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_from: Optional[EmailStr] = None
    enable_google_auth: Optional[bool] = None
    enable_github_auth: Optional[bool] = None
    session_timeout_hours: Optional[int] = None
    enforce_2fa_superadmin: Optional[bool] = None
    feature_custom_domains: Optional[bool] = None
    feature_api_access: Optional[bool] = None
    feature_analytics: Optional[bool] = None
    feature_sso: Optional[bool] = None
    feature_comments: Optional[bool] = None
    feature_newsletters: Optional[bool] = None
    feature_flags: Optional[PlatformFeatureFlags] = None
    plans: Optional[PlatformPlanSettings] = None


class PlatformSettingsResponse(PlatformSettings):
    class Config:
        from_attributes = True
