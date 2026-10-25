"""
Sponsor slots (Pro and Team) and the "Advertise with us" page (all plans).

Sponsors are managed by the blog's owner, shown on the blog with a
"Sponsored" label, and counted: an impression per page view that shows one,
a click through /s/{id} before the redirect. The Advertise page publishes
the owner's packages next to live 30-day numbers.
"""
import random
from datetime import date, timedelta
from typing import Optional

from fastapi import BackgroundTasks, Request
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session, func, select

from app.core.audit import add_audit_log
from app.core.blog_urls import blog_public_url
from app.core.datetimes import utc_now
from app.core.email import dispatch_email
from app.core.email_templates import get_advertise_enquiry_template, get_advertise_enquiry_template_text
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, NotFoundError, RateLimitError
from app.core.permissions import Permissions
from app.core.plans import get_blog_limits
from app.models import (
    AdvertiseEnquiry,
    Blog,
    BlogFollower,
    BlogSourceDaily,
    BlogVisitorDaily,
    FollowerStatus,
    Post,
    PostViewDaily,
    Sponsor,
    SponsorDaily,
    SponsorPlacement,
    User,
)
from app.models.post import PostStatus
from app.modules.analytics.service import is_non_reader_agent
from app.modules.settings.router import get_setting
from app.schemas import (
    AdvertiseEnquiryCreate,
    AdvertisePageRead,
    AdvertiseSettings,
    AdvertiseSource,
    AdvertiseTopPost,
    PublicSponsorRead,
    SponsorCreate,
    SponsorRead,
    SponsorUpdate,
)

ADVERTISE_KEY = "advertise"
STATS_DAYS = 30
ENQUIRIES_PER_HOUR = 10


# ── Who and which plan ───────────────────────────────────────────────────────

def ensure_sponsors_allowed(blog: Blog, current_user: User, session: Session) -> None:
    if Permissions.is_super_admin(current_user):
        return
    if not get_blog_limits(session, blog.id).can_use_sponsors:
        raise AuthorizationError(
            ErrorCode.PLAN_UPGRADE_REQUIRED,
            "Sponsor slots are available on the Pro and Team plans.",
        )


def _state(sponsor: Sponsor, today: date) -> str:
    if not sponsor.is_active:
        return "paused"
    if sponsor.starts_on and sponsor.starts_on > today:
        return "scheduled"
    if sponsor.ends_on and sponsor.ends_on < today:
        return "ended"
    return "running"


def _is_reader(blog_id: int, user_agent: Optional[str], current_user: Optional[User], session: Session) -> bool:
    """Not a crawler, and not the blog's own team looking at their blog."""
    if is_non_reader_agent(user_agent):
        return False
    return not (current_user and Permissions.get_user_role_in_blog(current_user, blog_id, session))


def _increment(session: Session, sponsor_id: int, counter: str) -> None:
    insert = pg_insert if session.get_bind().dialect.name == "postgresql" else sqlite_insert
    table = SponsorDaily.__table__
    session.execute(
        insert(table).values(sponsor_id=sponsor_id, day=utc_now().date(), **{counter: 1}).on_conflict_do_update(
            index_elements=["sponsor_id", "day"], set_={counter: table.c[counter] + 1},
        )
    )
    session.commit()


# ── Studio ───────────────────────────────────────────────────────────────────

def _to_read(sponsor: Sponsor, totals: dict[int, tuple[int, int]], today: date) -> SponsorRead:
    impressions, clicks = totals.get(sponsor.id, (0, 0))
    return SponsorRead(
        **sponsor.model_dump(exclude={"blog_id"}),
        state=_state(sponsor, today),
        impressions=impressions,
        clicks=clicks,
    )


def _totals(session: Session, sponsor_ids: list[int]) -> dict[int, tuple[int, int]]:
    if not sponsor_ids:
        return {}
    rows = session.exec(
        select(SponsorDaily.sponsor_id, func.sum(SponsorDaily.impressions), func.sum(SponsorDaily.clicks))
        .where(SponsorDaily.sponsor_id.in_(sponsor_ids))
        .group_by(SponsorDaily.sponsor_id)
    ).all()
    return {sponsor_id: (impressions or 0, clicks or 0) for sponsor_id, impressions, clicks in rows}


def list_sponsors(blog: Blog, session: Session) -> list[SponsorRead]:
    """Every sponsor with its campaign totals. Listing stays open on Free, so a lapsed plan still shows them."""
    sponsors = session.exec(
        select(Sponsor).where(Sponsor.blog_id == blog.id).order_by(Sponsor.created_at.desc(), Sponsor.id.desc())
    ).all()
    totals = _totals(session, [s.id for s in sponsors])
    today = utc_now().date()
    return [_to_read(s, totals, today) for s in sponsors]


def _get_sponsor(blog_id: int, sponsor_id: int, session: Session) -> Sponsor:
    sponsor = session.get(Sponsor, sponsor_id)
    if not sponsor or sponsor.blog_id != blog_id:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND)
    return sponsor


def create_sponsor(blog: Blog, payload: SponsorCreate, current_user: User, request: Optional[Request], session: Session) -> SponsorRead:
    ensure_sponsors_allowed(blog, current_user, session)
    sponsor = Sponsor(blog_id=blog.id, **payload.model_dump())
    session.add(sponsor)
    session.flush()
    add_audit_log(
        session, action="sponsor.create", resource_type="sponsor", resource_id=sponsor.id, blog_id=blog.id,
        actor=current_user, details={"name": sponsor.name, "placement": sponsor.placement.value}, request=request,
    )
    session.commit()
    session.refresh(sponsor)
    return _to_read(sponsor, {}, utc_now().date())


def update_sponsor(
    blog: Blog, sponsor_id: int, payload: SponsorUpdate, current_user: User, request: Optional[Request], session: Session,
) -> SponsorRead:
    ensure_sponsors_allowed(blog, current_user, session)
    sponsor = _get_sponsor(blog.id, sponsor_id, session)
    for key, value in payload.model_dump().items():
        setattr(sponsor, key, value)
    session.add(sponsor)
    add_audit_log(
        session, action="sponsor.update", resource_type="sponsor", resource_id=sponsor.id, blog_id=blog.id,
        actor=current_user, details={"name": sponsor.name, "is_active": sponsor.is_active}, request=request,
    )
    session.commit()
    session.refresh(sponsor)
    return _to_read(sponsor, _totals(session, [sponsor.id]), utc_now().date())


def delete_sponsor(blog: Blog, sponsor_id: int, current_user: User, request: Optional[Request], session: Session) -> None:
    """Allowed on any plan, so a lapsed workspace can still tidy up."""
    sponsor = _get_sponsor(blog.id, sponsor_id, session)
    add_audit_log(
        session, action="sponsor.delete", resource_type="sponsor", resource_id=sponsor.id, blog_id=blog.id,
        actor=current_user, details={"name": sponsor.name}, request=request,
    )
    session.delete(sponsor)
    session.commit()


# ── On the blog ──────────────────────────────────────────────────────────────

def active_sponsor(blog: Blog, placement: SponsorPlacement, api_base: str, session: Session) -> Optional[PublicSponsorRead]:
    """
    One sponsor running in this placement, picked at random when several are,
    so they share it. None on a plan without sponsors: they stop showing after
    a downgrade but aren't deleted.
    """
    if not get_blog_limits(session, blog.id).can_use_sponsors:
        return None
    today = utc_now().date()
    running = [
        s for s in session.exec(
            select(Sponsor).where(Sponsor.blog_id == blog.id, Sponsor.placement == placement, Sponsor.is_active == True)  # noqa: E712
        ).all()
        if _state(s, today) == "running"
    ]
    if not running:
        return None
    sponsor = random.choice(running)
    return PublicSponsorRead(
        id=sponsor.id, name=sponsor.name, logo_url=sponsor.logo_url, tagline=sponsor.tagline,
        click_url=f"{api_base.rstrip('/')}/s/{sponsor.id}",
    )


def _running_sponsor(sponsor_id: int, session: Session) -> Optional[Sponsor]:
    sponsor = session.get(Sponsor, sponsor_id)
    if not sponsor or _state(sponsor, utc_now().date()) != "running":
        return None
    if not get_blog_limits(session, sponsor.blog_id).can_use_sponsors:
        return None
    return sponsor


def record_impression(sponsor_id: int, user_agent: Optional[str], current_user: Optional[User], session: Session) -> None:
    sponsor = _running_sponsor(sponsor_id, session)
    if sponsor and _is_reader(sponsor.blog_id, user_agent, current_user, session):
        _increment(session, sponsor.id, "impressions")


def click_through(sponsor_id: int, user_agent: Optional[str], current_user: Optional[User], session: Session) -> str:
    """
    Count a click and return where to send the reader: always the sponsor's
    stored URL (never one from the request, so /s/ can't be used as an open
    redirect). A link to a sponsor that has since ended still goes through,
    uncounted.
    """
    sponsor = session.get(Sponsor, sponsor_id)
    if not sponsor:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND)
    if _running_sponsor(sponsor_id, session) and _is_reader(sponsor.blog_id, user_agent, current_user, session):
        _increment(session, sponsor.id, "clicks")
    return sponsor.url


# ── "Advertise with us" ──────────────────────────────────────────────────────

def advertise_settings(blog: Blog, session: Session) -> AdvertiseSettings:
    return AdvertiseSettings(**get_setting(session, blog.id, ADVERTISE_KEY, AdvertiseSettings))


def advertise_page(blog: Blog, session: Session) -> AdvertisePageRead:
    """The public page with live 30-day numbers. Hidden (404) until the owner turns it on."""
    page = advertise_settings(blog, session)
    if not page.enabled:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND)

    since = utc_now().date() - timedelta(days=STATS_DAYS - 1)
    readers = session.exec(
        select(func.coalesce(func.sum(BlogVisitorDaily.visitors), 0))
        .where(BlogVisitorDaily.blog_id == blog.id, BlogVisitorDaily.day >= since)
    ).one()
    views = session.exec(
        select(func.coalesce(func.sum(PostViewDaily.views), 0))
        .where(PostViewDaily.blog_id == blog.id, PostViewDaily.day >= since)
    ).one()

    followers = None
    if page.show_followers:
        followers = session.exec(
            select(func.count()).select_from(BlogFollower)
            .where(BlogFollower.blog_id == blog.id, BlogFollower.status == FollowerStatus.ACTIVE)
        ).one()

    sources = None
    if page.show_sources:
        visits = func.sum(BlogSourceDaily.visits)
        rows = session.exec(
            select(BlogSourceDaily.source, visits)
            .where(BlogSourceDaily.blog_id == blog.id, BlogSourceDaily.day >= since)
            .group_by(BlogSourceDaily.source)
            .order_by(visits.desc(), BlogSourceDaily.source)
        ).all()
        total = sum(count for _, count in rows) or 1
        sources = [AdvertiseSource(source=source, share=round(count * 100 / total)) for source, count in rows[:5]]

    top_posts = None
    if page.show_top_posts:
        period_views = func.sum(PostViewDaily.views)
        top_posts = [
            AdvertiseTopPost(title=title, slug=slug, views=count)
            for title, slug, count in session.exec(
                select(Post.title, Post.slug, period_views)
                .select_from(PostViewDaily)
                .join(Post, Post.id == PostViewDaily.post_id)
                .where(
                    PostViewDaily.blog_id == blog.id,
                    PostViewDaily.day >= since,
                    Post.status == PostStatus.PUBLISHED,
                    Post.is_sample == False,  # noqa: E712
                )
                .group_by(Post.id, Post.title, Post.slug)
                .order_by(period_views.desc(), Post.id)
                .limit(3)
            ).all()
        ]

    return AdvertisePageRead(
        blog_name=blog.name,
        intro=page.intro,
        packages=page.packages,
        monthly_readers=readers,
        monthly_views=views,
        followers=followers,
        sources=sources,
        top_posts=top_posts,
    )


def send_enquiry(blog: Blog, payload: AdvertiseEnquiryCreate, background_tasks: BackgroundTasks, session: Session) -> None:
    if payload.website:
        return  # the honeypot was filled in: a bot
    page = advertise_settings(blog, session)
    if not page.enabled:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND)

    recent = session.exec(
        select(func.count()).select_from(AdvertiseEnquiry).where(
            AdvertiseEnquiry.blog_id == blog.id,
            AdvertiseEnquiry.created_at >= utc_now() - timedelta(hours=1),
        )
    ).one()
    if recent >= ENQUIRIES_PER_HOUR:
        raise RateLimitError(message="This blog has had a lot of enquiries in the last hour. Please try again later.")

    enquiry = AdvertiseEnquiry(blog_id=blog.id, **payload.model_dump(exclude={"website"}))
    session.add(enquiry)
    session.commit()

    owner = session.get(User, blog.owner_id)
    recipient = page.contact_email or (owner.email if owner else None)
    if not recipient:
        return
    fields = dict(
        blog_name=blog.name, name=enquiry.name, email=enquiry.email,
        company=enquiry.company, budget=enquiry.budget, message=enquiry.message,
    )
    dispatch_email(
        background_tasks,
        recipient,
        f"Sponsorship enquiry for {blog.name}",
        get_advertise_enquiry_template(**fields, advertise_url=f"{blog_public_url(blog)}/advertise"),
        get_advertise_enquiry_template_text(**fields),
    )
