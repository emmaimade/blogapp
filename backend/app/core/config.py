import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # ── Frontend URLs ──
    PUBLIC_SITE_URL: str = "http://localhost:5175"
    ADMIN_STUDIO_URL: str = "http://localhost:5173"
    PUBLIC_LOGO_URL: str = "https://inko.blog/static/email/inko-logo.png"

    # ── SMTP Mail Infrastructure Configurations ──
    # validation maps both SMTP_SERVER and legacy SMTP_HOST to this field
    SMTP_SERVER: str = Field("localhost", validation_alias="SMTP_HOST")
    SMTP_PORT: int = 25
    SMTP_TLS: bool = True
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # Maps EMAILS_FROM_EMAIL and legacy EMAIL_FROM cleanly
    EMAILS_FROM_EMAIL: str = Field("no-reply@example.com", validation_alias="EMAIL_FROM")
    EMAILS_FROM_NAME: str = "Inko"

    # Recipient for the marketing site's contact form. Falls back to
    # EMAILS_FROM_EMAIL when unset, so this isn't required to get a working setup.
    CONTACT_NOTIFICATION_EMAIL: Optional[str] = None

    # ── Cloudinary Media Configurations ──
    CLOUDINARY_NAME: str = Field(..., validation_alias="cloudinary_name")
    CLOUDINARY_API_KEY: str = Field(..., validation_alias="cloudinary_api_key")
    CLOUDINARY_API_SECRET: str = Field(..., validation_alias="cloudinary_api_secret")

    # ── Core App Security Settings ──
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    DATABASE_URL: Optional[str] = None
    # Auth cookies are Secure by default (required in production, over HTTPS).
    # Browsers already treat http://localhost as a trustworthy origin for
    # Secure cookies, so local dev doesn't need this — it exists so the test
    # suite's plain-http TestClient can actually round-trip cookies.
    COOKIE_SECURE: bool = True
    # How many reverse proxies we control sit in front of the app, i.e. how
    # many right-hand X-Forwarded-For entries were written by our own
    # infrastructure rather than the client. The client IP is the entry that
    # many hops from the right; anything to its left is client-supplied and
    # never trusted. 1 suits Vercel (which also replaces the header outright)
    # and a single nginx/load balancer. 0 ignores the header entirely and uses
    # the socket peer — use that when nothing proxies the app.
    TRUSTED_PROXY_HOPS: int = Field(1, ge=0)

    # ── Uploads ──
    MAX_UPLOAD_SIZE_MB: int = 5

    # ── CORS ──
    # Comma-separated list of allowed origins. Defaults to the current
    # production + local-dev set, so an unset env var changes nothing.
    CORS_ORIGINS: str = (
        "https://blogapp-admin-studio-livid.vercel.app,"
        "https://blogapp-blog.vercel.app,"
        "http://localhost:8000,"
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://localhost:5175,"
        "http://127.0.0.1:5173,"
        "http://127.0.0.1:5174,"
        "http://127.0.0.1:5175,"
        "http://127.0.0.1:8000"
    )

    # ── Multi-tenant routing ──
    # A hostname ending in this is treated as one of our own subdomains
    # ({slug}.{PUBLIC_BLOG_BASE_DOMAIN}); anything else is a candidate
    # tenant-owned custom domain.
    PUBLIC_BLOG_BASE_DOMAIN: str = "inko.blog"

    # ── Billing (Paystack) ──
    # All optional so the app boots without them; billing endpoints refuse
    # to run until the secret key and plan codes are set. Plan codes come
    # from the plans created in the Paystack dashboard (PLN_...).
    PAYSTACK_SECRET_KEY: Optional[str] = None
    PAYSTACK_PUBLIC_KEY: Optional[str] = None
    PAYSTACK_PLAN_PRO_MONTHLY: Optional[str] = None
    PAYSTACK_PLAN_PRO_YEARLY: Optional[str] = None
    PAYSTACK_PLAN_TEAM_MONTHLY: Optional[str] = None
    PAYSTACK_PLAN_TEAM_YEARLY: Optional[str] = None
    TRIAL_DAYS: int = Field(14, ge=0)
    # How long a failed renewal keeps paid features before dropping to Free.
    PAST_DUE_GRACE_DAYS: int = Field(3, ge=0)
    # Workspaces one account may own (superadmins exempt), and how many it
    # may create per hour — a guard against scripted sign-up abuse.
    MAX_OWNED_WORKSPACES: int = Field(10, ge=1)
    WORKSPACE_CREATIONS_PER_HOUR: int = Field(5, ge=1)

    # ── Observability ──
    LOG_LEVEL: str = "INFO"
    # SQLAlchemy statement echo. Off by default: it writes every statement and
    # its bound parameters to stdout, which is noisy in production and puts row
    # data into logs. Set SQL_ECHO=true locally when debugging a query.
    SQL_ECHO: bool = False

    # Pydantic v2 modern environment config block
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

# Singleton-style settings instance used across the app
settings = Settings()

# Backwards-compatible module level constants
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS
DATABASE_URL = settings.DATABASE_URL