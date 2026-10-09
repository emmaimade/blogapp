from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.permissions import (
    get_current_blog,
    get_public_blog,
    get_user_blogs,
    require_blog_owner,
    require_completed_onboarding,
)
from app.core.security import get_current_user, require_verified_email
from app.models import Blog, User
from app.schemas import (
    BlogCreate,
    BlogDashboardSummary,
    BlogMemberCreate,
    BlogMemberRead,
    BlogMemberUpdate,
    OwnershipTransfer,
    BlogRead,
    BlogUpdate,
    OnboardingAboutUpdate,
    OnboardingPlanUpdate,
    OnboardingProfileUpdate,
    OnboardingPublicationUpdate,
    OnboardingState,
    OnboardingTeamComplete,
    PageMeta,
    SubscriptionRead,
)
from . import service as blog_service

router = APIRouter(prefix="/blogs", tags=["blogs"])


# ── Blog CRUD ────────────────────────────────────────────────────────────────

@router.post("/", response_model=BlogRead)
def create_blog(
    blog_data: BlogCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return blog_service.create_blog(blog_data, session, current_user, request=request)


@router.get("/me", response_model=List[BlogRead])
def read_my_blogs(
    blogs: List[Blog] = Depends(get_user_blogs),
):
    return blogs


@router.get("/by-subdomain/{subdomain}", response_model=BlogRead)
def read_blog_by_subdomain(
    subdomain: str,
    session: Session = Depends(get_session),
):
    return blog_service.read_blog_by_subdomain(subdomain, session)


@router.get("/resolve", response_model=BlogRead)
def resolve_blog_by_host(
    host: str,
    session: Session = Depends(get_session),
):
    """Resolves a tenant from a full request hostname — subdomain or custom domain alike."""
    return blog_service.resolve_blog_by_host(host, session)


@router.get("/meta", response_model=PageMeta)
def read_page_meta(
    host: str,
    path: str = "/",
    session: Session = Depends(get_session),
):
    """Read-only <head> metadata for a public page — used by the blog's edge middleware."""
    return blog_service.get_page_meta(host, path, session)


@router.get("/check-slug/{slug}")
def check_slug_availability(
    slug: str,
    session: Session = Depends(get_session),
):
    return blog_service.check_slug_availability(slug, session)


@router.get("/{blog_id}", response_model=BlogRead)
def read_blog(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_public_blog),
):
    return blog


@router.patch("/{blog_id}", response_model=BlogRead)
def update_blog(
    blog_id: int,
    blog_data: BlogUpdate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
    __: None = Depends(require_completed_onboarding),
):
    return blog_service.update_blog(blog_id, blog_data, session, current_user, request=request)


# ── Onboarding ───────────────────────────────────────────────────────────────

@router.get("/{blog_id}/onboarding", response_model=OnboardingState)
def get_onboarding_state(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    return blog_service.get_onboarding_state(blog, session)


@router.put("/{blog_id}/onboarding/about", response_model=OnboardingState)
def update_onboarding_about(
    blog_id: int,
    payload: OnboardingAboutUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return blog_service.update_onboarding_about(blog_id, payload, session)


@router.put("/{blog_id}/onboarding/profile", response_model=OnboardingState)
def update_onboarding_profile(
    blog_id: int,
    payload: OnboardingProfileUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return blog_service.update_onboarding_profile(blog_id, payload, session)


@router.put("/{blog_id}/onboarding/publication", response_model=OnboardingState)
def update_onboarding_publication(
    blog_id: int,
    payload: OnboardingPublicationUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return blog_service.update_onboarding_publication(blog_id, payload, session)


@router.post("/{blog_id}/onboarding/team/complete", response_model=OnboardingState)
def complete_onboarding_team_step(
    blog_id: int,
    payload: OnboardingTeamComplete,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return blog_service.complete_onboarding_team_step(blog_id, payload, session)


@router.put("/{blog_id}/onboarding/plan", response_model=OnboardingState)
def update_onboarding_plan(
    blog_id: int,
    payload: OnboardingPlanUpdate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_verified_email),
    _: None = Depends(require_blog_owner),
):
    return blog_service.update_onboarding_plan(blog_id, payload, session, current_user, request=request)


# ── Members ──────────────────────────────────────────────────────────────────

@router.get("/{blog_id}/members", response_model=List[BlogMemberRead])
def read_blog_members(
    blog_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return blog_service.read_blog_members(blog_id, session)


@router.post("/{blog_id}/members/{member_id}/trigger-reset-email")
def trigger_member_reset_email(
    blog_id: int,
    member_id: int,
    background_tasks: BackgroundTasks,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    return blog_service.trigger_member_reset_email(
        blog_id, member_id, session, current_user, background_tasks, request=request
    )


@router.post("/{blog_id}/members", response_model=BlogMemberRead, status_code=status.HTTP_201_CREATED)
def invite_blog_member(
    blog_id: int,
    payload: BlogMemberCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    return blog_service.invite_blog_member(blog_id, payload, session, current_user, request=request)


# Before /members/{member_id}, or "me" would be parsed (and rejected) as an id.
@router.delete("/{blog_id}/members/me", status_code=status.HTTP_204_NO_CONTENT)
def leave_blog(
    blog_id: int,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: Blog = Depends(get_current_blog),
):
    blog_service.leave_blog(blog_id, session, current_user, request=request)


@router.post("/{blog_id}/transfer-ownership", response_model=BlogMemberRead)
def transfer_ownership(
    blog_id: int,
    payload: OwnershipTransfer,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    return blog_service.transfer_ownership(blog_id, payload.member_id, session, current_user, request=request)


@router.delete("/{blog_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_blog_member(
    blog_id: int,
    member_id: int,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    blog_service.remove_blog_member(blog_id, member_id, session, current_user, request=request)


@router.patch("/{blog_id}/members/{member_id}", response_model=BlogMemberRead)
def update_blog_member_permissions(
    blog_id: int,
    member_id: int,
    payload: BlogMemberUpdate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return blog_service.update_blog_member_permissions(blog_id, member_id, payload, session, current_user, request=request)


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/{blog_id}/dashboard", response_model=BlogDashboardSummary)
def get_blog_dashboard_summary(
    blog_id: int,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return blog_service.get_blog_dashboard_summary(blog, session, current_user)


# ── Subscriptions ────────────────────────────────────────────────────────────

@router.get("/{blog_id}/subscription", response_model=SubscriptionRead)
def get_blog_subscription_endpoint(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    return blog_service.get_blog_subscription(blog, session)
