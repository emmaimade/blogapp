from datetime import datetime
from typing import Optional
from sqlalchemy import Column, DateTime as SQLDateTime
from sqlmodel import Field, SQLModel
from app.models.user import utcnow


class EmailVerification(SQLModel, table=True):
    __tablename__ = "email_verifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", nullable=False)
    token: str = Field(index=True, unique=True, nullable=False)  # Cryptographic SHA-256 hash

    expires_at: datetime = Field(sa_column=Column(SQLDateTime(timezone=True), nullable=False))
    used_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))


class PasswordResetToken(SQLModel, table=True):
    __tablename__ = "password_reset_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", nullable=False)
    token: str = Field(index=True, unique=True, nullable=False)  # Cryptographic SHA-256 hash

    expires_at: datetime = Field(sa_column=Column(SQLDateTime(timezone=True), nullable=False))
    used_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))


class RefreshToken(SQLModel, table=True):
    """
    Unlike EmailVerification/PasswordResetToken, a refresh token must be
    repeatedly presentable until it's rotated or explicitly revoked — so this
    carries `revoked_at` rather than a one-shot `used_at`.
    """
    __tablename__ = "refresh_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", nullable=False)
    token: str = Field(index=True, unique=True, nullable=False)  # Cryptographic SHA-256 hash

    expires_at: datetime = Field(sa_column=Column(SQLDateTime(timezone=True), nullable=False))
    revoked_at: Optional[datetime] = Field(default=None, sa_column=Column(SQLDateTime(timezone=True), nullable=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))


class LoginAttempt(SQLModel, table=True):
    """
    One row per *failed* login attempt, used to throttle brute-forcing of
    POST /auth/login. Deliberately not tied to a user_id — the identifier may
    not resolve to a real account, and per-IP throttling needs to catch that
    case too (credential stuffing across many nonexistent usernames).
    """
    __tablename__ = "login_attempts"

    id: Optional[int] = Field(default=None, primary_key=True)
    identifier: str = Field(index=True, nullable=False)  # lowercased username/email as submitted
    ip_address: Optional[str] = Field(default=None, index=True, nullable=True)
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(SQLDateTime(timezone=True), nullable=False))