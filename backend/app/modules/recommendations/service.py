"""
Blogs recommending other Inko blogs to their readers.

An owner picks up to five blogs. A reader who has just confirmed a follow
sees them on the confirm page and can follow any of them in one tap — the
confirm link they just clicked proves the address, so those follows are
active straight away. The same list shows as "Recommended reads" on the
blog, and each blog sees the followers it sent and received.
"""
import hashlib
from datetime import timedelta
from typing import Optional

from fastapi import Request
from sqlmodel import Session, func, select

from app.core.audit import add_audit_log
from app.core.blog_urls import blog_public_url
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, BadRequestError, GoneError, ValidationError
from app.core.notifications import add_notification
from app.core.plans import ensure_follower_capacity
from app.models import (
    Blog,
    BlogFollower,
    BlogRecommendation,
    FollowerStatus,
    OnboardingStatus,
    Post,
    User,
)
from app.models.post import PostStatus
from app.modules.followers.service import CONFIRM_LINK_DAYS
from app.schemas import (
    ReceivedRecommendation,
    RecommendationFollowResult,
    RecommendationsOverview,
    RecommendedBlog,
    StudioRecommendation,
)

MAX_RECOMMENDATIONS = 5
SEARCH_LIMIT = 10


# ── Who can be recommended ───────────────────────────────────────────────────

def _eligible_filter():
    """Live, set up, taking followers, not opted out, and with something to read."""
    has_post = (
        select(Post.id)
        .where(Post.blog_id == Blog.id, Post.status == PostStatus.PUBLISHED, Post.is_sample == False)  # noqa: E712
        .exists()
    )
    return (
        Blog.is_active == True,  # noqa: E712
        Blog.onboarding_status == OnboardingStatus.COMPLETED,
        Blog.followers_enabled == True,  # noqa: E712
        Blog.allow_recommendations == True,  # noqa: E712
        has_post,
    )


def _eligible_ids(session: Session, blog_ids: list[int]) -> set[int]:
    if not blog_ids:
        return set()
    return set(session.exec(select(Blog.id).where(Blog.id.in_(blog_ids), *_eligible_filter())).all())


def _public(blog: Blog) -> RecommendedBlog:
    return RecommendedBlog(id=blog.id, name=blog.name, tagline=blog.tagline, logo_url=blog.logo_url, url=blog_public_url(blog))


def shown_recommendations(blog_id: int, session: Session) -> list[RecommendedBlog]:
    """What readers see: the owner's list in order, minus blogs that no longer qualify."""
    rows = session.exec(
        select(Blog)
        .join(BlogRecommendation, BlogRecommendation.recommended_blog_id == Blog.id)
        .where(BlogRecommendation.blog_id == blog_id, *_eligible_filter())
        .order_by(BlogRecommendation.position, BlogRecommendation.id)
    ).all()
    return [_public(blog) for blog in rows]


# ── Studio (owner) ───────────────────────────────────────────────────────────

def search_blogs(blog: Blog, q: str, session: Session) -> list[RecommendedBlog]:
    """Blogs the owner could recommend, by name."""
    term = (q or "").strip()
    if len(term) < 2:
        return []
    rows = session.exec(
        select(Blog)
        .where(Blog.id != blog.id, Blog.name.ilike(f"%{term}%"), *_eligible_filter())
        .order_by(Blog.name)
        .limit(SEARCH_LIMIT)
    ).all()
    return [_public(b) for b in rows]


def overview(blog: Blog, session: Session) -> RecommendationsOverview:
    mine = session.exec(
        select(BlogRecommendation, Blog)
        .join(Blog, Blog.id == BlogRecommendation.recommended_blog_id)
        .where(BlogRecommendation.blog_id == blog.id)
        .order_by(BlogRecommendation.position, BlogRecommendation.id)
    ).all()
    shown = _eligible_ids(session, [b.id for _, b in mine])

    def followers_from(source_id: int, target_id: int) -> int:
        return session.exec(
            select(func.count()).select_from(BlogFollower).where(
                BlogFollower.blog_id == target_id,
                BlogFollower.referred_by_blog_id == source_id,
                BlogFollower.status == FollowerStatus.ACTIVE,
            )
        ).one()

    recommendations = [
        StudioRecommendation(**_public(b).model_dump(), followers_sent=followers_from(blog.id, b.id), shown=b.id in shown)
        for _, b in mine
    ]

    # Blogs that sent this one followers, or recommend it now.
    sent_by = dict(session.exec(
        select(BlogFollower.referred_by_blog_id, func.count())
        .where(
            BlogFollower.blog_id == blog.id,
            BlogFollower.referred_by_blog_id.is_not(None),
            BlogFollower.status == FollowerStatus.ACTIVE,
        )
        .group_by(BlogFollower.referred_by_blog_id)
    ).all())
    recommending_now = set(session.exec(
        select(BlogRecommendation.blog_id).where(BlogRecommendation.recommended_blog_id == blog.id)
    ).all())
    received = [
        ReceivedRecommendation(
            id=b.id, name=b.name, url=blog_public_url(b),
            followers=sent_by.get(b.id, 0), recommends_you_now=b.id in recommending_now,
        )
        for b in session.exec(select(Blog).where(Blog.id.in_(set(sent_by) | recommending_now))).all()
    ]
    received.sort(key=lambda r: (-r.followers, r.name))

    return RecommendationsOverview(
        recommendations=recommendations, received=received, allow_recommendations=blog.allow_recommendations,
    )


def set_recommendations(
    blog: Blog, blog_ids: list[int], current_user: User, request: Optional[Request], session: Session,
) -> RecommendationsOverview:
    """Replace the list (adds, removes and reorders in one go). Newly added blogs' owners are told."""
    if len(set(blog_ids)) != len(blog_ids):
        raise ValidationError(errors={"blog_ids": "Each blog can only be listed once."})
    if blog.id in blog_ids:
        raise ValidationError(errors={"blog_ids": "A blog can't recommend itself."})
    if len(blog_ids) > MAX_RECOMMENDATIONS:
        raise ValidationError(errors={"blog_ids": f"Recommend up to {MAX_RECOMMENDATIONS} blogs."})

    existing = {r.recommended_blog_id: r for r in session.exec(
        select(BlogRecommendation).where(BlogRecommendation.blog_id == blog.id)
    ).all()}
    new_ids = [i for i in blog_ids if i not in existing]
    # Blogs already on the list may stay even if they've stopped qualifying
    # (they're just hidden); new ones have to qualify now.
    if set(new_ids) - _eligible_ids(session, new_ids):
        raise BadRequestError(ErrorCode.INVALID_INPUT, "One of those blogs can't be recommended right now.")

    for recommended_id, row in existing.items():
        if recommended_id not in blog_ids:
            session.delete(row)
    for position, recommended_id in enumerate(blog_ids):
        row = existing.get(recommended_id) or BlogRecommendation(blog_id=blog.id, recommended_blog_id=recommended_id)
        row.position = position
        session.add(row)

    for recommended_id in new_ids:
        target = session.get(Blog, recommended_id)
        add_notification(
            session,
            user_id=target.owner_id,
            blog_id=target.id,
            type="blog_recommended",
            title=f"{blog.name} now recommends your blog",
            body="Readers who follow them will be invited to follow you too.",
            link=f"/admin/audience?blog={target.id}",
        )
    add_audit_log(
        session, action="blog.recommendations_update", resource_type="blog", resource_id=blog.id, blog_id=blog.id,
        actor=current_user, details={"recommended_blog_ids": blog_ids}, request=request,
    )
    session.commit()
    return overview(blog, session)


def set_allow_recommendations(blog: Blog, allow: bool, current_user: User, request: Optional[Request], session: Session) -> bool:
    if blog.allow_recommendations != allow:
        blog.allow_recommendations = allow
        session.add(blog)
        add_audit_log(
            session, action="blog.recommendations_toggle", resource_type="blog", resource_id=blog.id, blog_id=blog.id,
            actor=current_user, details={"allow_recommendations": allow}, request=request,
        )
        session.commit()
    return blog.allow_recommendations


# ── Following from the confirm page ──────────────────────────────────────────

def _confirmed_follower(token: str, session: Session) -> BlogFollower:
    """The follow the reader has just confirmed, from the same emailed token."""
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    follower = session.exec(select(BlogFollower).where(BlogFollower.confirm_token_hash == token_hash)).first()
    if follower is None or follower.status != FollowerStatus.ACTIVE:
        raise BadRequestError(ErrorCode.INVALID_TOKEN)
    sent_at = as_utc(follower.confirm_sent_at)
    if sent_at is None or utc_now() - sent_at > timedelta(days=CONFIRM_LINK_DAYS):
        raise GoneError(ErrorCode.LINK_EXPIRED)
    return follower


def follow_recommended(token: str, blog_ids: list[int], session: Session) -> RecommendationFollowResult:
    """
    Follow blogs the just-followed blog recommends. The reader proved the
    address by clicking the emailed link moments ago, so these are active at
    once. Only blogs on that blog's shown list count; ones already followed,
    full, or switched off are skipped rather than failing the rest.
    """
    source = _confirmed_follower(token, session)
    allowed = {b.id for b in shown_recommendations(source.blog_id, session)}
    if not set(blog_ids) <= allowed:
        raise AuthorizationError(ErrorCode.FORBIDDEN, "You can only follow the blogs recommended here.")

    followed: list[str] = []
    skipped: list[str] = []
    now = utc_now()
    for blog_id in dict.fromkeys(blog_ids):
        target = session.get(Blog, blog_id)
        existing = session.exec(
            select(BlogFollower).where(BlogFollower.blog_id == blog_id, BlogFollower.email == source.email)
        ).first()
        if existing and existing.status == FollowerStatus.ACTIVE:
            skipped.append(target.name)
            continue
        try:
            ensure_follower_capacity(session, blog_id)
        except AuthorizationError:
            skipped.append(target.name)
            continue
        follower = existing or BlogFollower(blog_id=blog_id, email=source.email)
        follower.status = FollowerStatus.ACTIVE
        follower.confirmed_at = now
        follower.unsubscribed_at = None
        follower.referred_by_blog_id = source.blog_id
        session.add(follower)
        followed.append(target.name)
    session.commit()
    return RecommendationFollowResult(followed=followed, skipped=skipped)
