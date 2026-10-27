from datetime import date, datetime
from typing import List, Optional
from urllib.parse import urlsplit

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.sponsor import SponsorPlacement
from app.schemas.datetime_mixin import UTCDatetimeMixin


def _https_url(value: Optional[str]) -> Optional[str]:
    """Sponsor links and logos must be https URLs with a host — no javascript:, no plain http."""
    if value is None:
        return value
    value = value.strip()
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.netloc:
        raise ValueError("Use a full https:// address.")
    return value


# ── Sponsors (studio) ────────────────────────────────────────────────────────

class SponsorBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    logo_url: Optional[str] = Field(default=None, max_length=2000)
    tagline: str = Field(default="", max_length=120)
    url: str = Field(max_length=2000)
    placement: SponsorPlacement
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    is_active: bool = True

    @field_validator("url")
    @classmethod
    def _check_url(cls, value: str) -> str:
        return _https_url(value)

    @field_validator("logo_url")
    @classmethod
    def _check_logo(cls, value: Optional[str]) -> Optional[str]:
        return _https_url(value) if value else None

    @model_validator(mode="after")
    def _dates_in_order(self):
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("The end date can't be before the start date.")
        return self


class SponsorCreate(SponsorBase):
    pass


class SponsorUpdate(SponsorBase):
    pass


class SponsorRead(UTCDatetimeMixin, SponsorBase):
    id: int
    created_at: datetime
    # Running / Scheduled / Ended / Paused, worked out from the dates and switch.
    state: str
    impressions: int
    clicks: int


class PublicSponsorRead(BaseModel):
    """What the blog shows. The link goes through the click counter, not straight to `url`."""
    id: int
    name: str
    logo_url: Optional[str] = None
    tagline: str
    click_url: str


# ── "Advertise with us" ──────────────────────────────────────────────────────

class AdvertisePackage(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    price: str = Field(default="", max_length=60)  # free text: "₦50,000 / month"
    description: str = Field(default="", max_length=300)


class AdvertiseSettings(BaseModel):
    """Stored as the blog's "advertise" site setting. Off until the owner publishes it."""
    enabled: bool = False
    intro: str = Field(default="", max_length=2000)
    packages: List[AdvertisePackage] = Field(default_factory=list, max_length=5)
    show_followers: bool = True
    show_sources: bool = True
    show_top_posts: bool = True
    # "Your brand here" in sponsor slots nobody's running, linking to the page.
    show_house_ads: bool = True
    # An "Advertise" link in the blog's top menu as well as its footer.
    show_in_menu: bool = False
    # Enquiries go here, else to the blog owner.
    contact_email: Optional[EmailStr] = None


class AdvertiseSource(BaseModel):
    source: str
    share: int  # whole percent of visits


class AdvertiseTopPost(BaseModel):
    title: str
    slug: str
    views: int


class AdvertisePageRead(BaseModel):
    """The public page: the owner's copy and packages, and live 30-day numbers."""
    blog_name: str
    intro: str
    packages: List[AdvertisePackage]
    monthly_readers: int
    monthly_views: int
    followers: Optional[int] = None
    sources: Optional[List[AdvertiseSource]] = None
    top_posts: Optional[List[AdvertiseTopPost]] = None
    # How the blog points readers here: house ads in empty slots, a top-menu link.
    show_house_ads: bool = True
    show_in_menu: bool = False


class AdvertiseEnquiryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    company: str = Field(default="", max_length=120)
    budget: str = Field(default="", max_length=60)
    message: str = Field(min_length=1, max_length=3000)
    # Honeypot, as on the follow form.
    website: Optional[str] = None
