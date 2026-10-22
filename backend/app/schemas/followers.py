from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class FollowCreate(BaseModel):
    email: EmailStr
    source_post_id: Optional[int] = None
    # Honeypot: hidden from people by the follow form, so only bots fill it.
    website: Optional[str] = None


class FollowTokenPayload(BaseModel):
    token: str = Field(min_length=1, max_length=200)


class FollowAccepted(BaseModel):
    message: str


class FollowResult(BaseModel):
    """What the confirm/unsubscribe pages show: which blog it was about."""
    blog_name: str
