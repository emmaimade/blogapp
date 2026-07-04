from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from app.models.user import utcnow

class EmailVerification(SQLModel, table=True):
    __tablename__ = "email_verifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", nullable=False)
    token: str = Field(index=True, unique=True, nullable=False)  # Cryptographic SHA-256 hash
    
    expires_at: datetime = Field(nullable=False)
    used_at: Optional[datetime] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=utcnow)


class PasswordResetToken(SQLModel, table=True):
    __tablename__ = "password_reset_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", nullable=False)
    token: str = Field(index=True, unique=True, nullable=False)  # Cryptographic SHA-256 hash
    
    expires_at: datetime = Field(nullable=False)
    used_at: Optional[datetime] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=utcnow)