from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, Request, Response, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.permissions import get_current_blog, get_public_blog, require_blog_owner
from app.core.security import get_current_user, get_current_user_optional
from app.models import Blog, SponsorPlacement, User
from app.modules.posts.service import upload_post_image
from app.modules.settings.router import update_setting
from app.schemas import (
    AdvertiseEnquiryCreate,
    AdvertisePageRead,
    AdvertiseSettings,
    PublicSponsorRead,
    SponsorCreate,
    SponsorRead,
    SponsorUpdate,
)
from . import service as sponsor_service

router = APIRouter(tags=["sponsors"])


# ── Studio: the owner's Sponsors page ────────────────────────────────────────

@router.get("/blogs/{blog_id}/sponsors", response_model=List[SponsorRead])
def list_sponsors(
    blog_id: int,
    blog: Blog = Depends(get_current_blog),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return sponsor_service.list_sponsors(blog, session)


@router.post("/blogs/{blog_id}/sponsors", response_model=SponsorRead, status_code=status.HTTP_201_CREATED)
def create_sponsor(
    blog_id: int,
    payload: SponsorCreate,
    request: Request,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return sponsor_service.create_sponsor(blog, payload, current_user, request, session)


@router.post("/blogs/{blog_id}/sponsors/upload-logo")
def upload_sponsor_logo(
    blog_id: int,
    file: UploadFile = File(...),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    sponsor_service.ensure_sponsors_allowed(blog, current_user, session)
    return upload_post_image(file)


@router.put("/blogs/{blog_id}/sponsors/{sponsor_id}", response_model=SponsorRead)
def update_sponsor(
    blog_id: int,
    sponsor_id: int,
    payload: SponsorUpdate,
    request: Request,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return sponsor_service.update_sponsor(blog, sponsor_id, payload, current_user, request, session)


@router.delete("/blogs/{blog_id}/sponsors/{sponsor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sponsor(
    blog_id: int,
    sponsor_id: int,
    request: Request,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    sponsor_service.delete_sponsor(blog, sponsor_id, current_user, request, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/blogs/{blog_id}/advertise/settings", response_model=AdvertiseSettings)
def get_advertise_settings(
    blog_id: int,
    blog: Blog = Depends(get_current_blog),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return sponsor_service.advertise_settings(blog, session)


@router.put("/blogs/{blog_id}/advertise/settings", response_model=AdvertiseSettings)
def update_advertise_settings(
    blog_id: int,
    payload: AdvertiseSettings,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    """Available on every plan. Logged like the other settings sections."""
    return update_setting(session, blog_id, sponsor_service.ADVERTISE_KEY, payload, current_user, request=request)


# ── The public blog ──────────────────────────────────────────────────────────

@router.get("/blogs/{blog_id}/sponsors/active", response_model=Optional[PublicSponsorRead])
def get_active_sponsor(
    blog_id: int,
    placement: SponsorPlacement,
    request: Request,
    blog: Blog = Depends(get_public_blog),
    session: Session = Depends(get_session),
):
    """A sponsor running in `placement`, or null."""
    api_base = settings.PUBLIC_API_URL or str(request.base_url)
    return sponsor_service.active_sponsor(blog, placement, api_base, session)


@router.post("/sponsors/{sponsor_id}/impression", status_code=status.HTTP_204_NO_CONTENT)
def record_sponsor_impression(
    sponsor_id: int,
    user_agent: Optional[str] = Header(default=None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session),
):
    sponsor_service.record_impression(sponsor_id, user_agent, current_user, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/s/{sponsor_id}", include_in_schema=False)
def sponsor_click(
    sponsor_id: int,
    user_agent: Optional[str] = Header(default=None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session),
):
    """Counts the click, then sends the reader on to the sponsor."""
    url = sponsor_service.click_through(sponsor_id, user_agent, current_user, session)
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND)


@router.get("/blogs/{blog_id}/advertise", response_model=AdvertisePageRead)
def get_advertise_page(
    blog_id: int,
    blog: Blog = Depends(get_public_blog),
    session: Session = Depends(get_session),
):
    return sponsor_service.advertise_page(blog, session)


@router.post("/blogs/{blog_id}/advertise/enquiry", status_code=status.HTTP_202_ACCEPTED)
def send_advertise_enquiry(
    blog_id: int,
    payload: AdvertiseEnquiryCreate,
    background_tasks: BackgroundTasks,
    blog: Blog = Depends(get_public_blog),
    session: Session = Depends(get_session),
):
    sponsor_service.send_enquiry(blog, payload, background_tasks, session)
    return {"ok": True, "message": "Thanks — the blog's owner will get back to you."}
