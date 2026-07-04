import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # ── Frontend URLs ──
    PUBLIC_SITE_URL: str = "http://localhost:5175"
    ADMIN_STUDIO_URL: str = "http://localhost:5173"

    # ── SMTP Mail Infrastructure Configurations ──
    # validation maps both SMTP_SERVER and legacy SMTP_HOST to this field
    SMTP_SERVER: str = Field("localhost", validation_alias="SMTP_HOST")
    SMTP_PORT: int = 25
    SMTP_TLS: bool = True
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # Maps EMAILS_FROM_EMAIL and legacy EMAIL_FROM cleanly
    EMAILS_FROM_EMAIL: str = Field("no-reply@example.com", validation_alias="EMAIL_FROM")
    EMAILS_FROM_NAME: str = "BlogApp"

    # ── Cloudinary Media Configurations ──
    CLOUDINARY_NAME: str = Field(..., validation_alias="cloudinary_name")
    CLOUDINARY_API_KEY: str = Field(..., validation_alias="cloudinary_api_key")
    CLOUDINARY_API_SECRET: str = Field(..., validation_alias="cloudinary_api_secret")

    # ── Core App Security Settings ──
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DATABASE_URL: Optional[str] = None

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
DATABASE_URL = settings.DATABASE_URL