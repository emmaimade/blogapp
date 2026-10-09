"""
Plan entitlements: what each subscription plan allows, and which plan a
workspace is actually entitled to right now.

`get_effective_plan` works the answer out from the subscription's status and
dates on every call rather than relying on a background job to flip rows when
a trial or billing period ends — the API runs on Vercel serverless, where
the APScheduler jobs in app.core.scheduler aren't guaranteed to run.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError
from app.models.blog import BlogInvitation, BlogMember, BlogSubscription, SubscriptionPlan, SubscriptionStatus
from app.models.post import Post, PostStatus


@dataclass(frozen=True)
class PlanLimits:
    # None means unlimited.
    max_members: Optional[int]
    max_published_posts: Optional[int]
    can_schedule_posts: bool
    can_remove_branding: bool
    can_use_custom_domain: bool
    activity_log_days: int


PLAN_LIMITS: dict[SubscriptionPlan, PlanLimits] = {
    SubscriptionPlan.FREE: PlanLimits(
        max_members=1,
        max_published_posts=30,
        can_schedule_posts=False,
        can_remove_branding=False,
        can_use_custom_domain=False,
        activity_log_days=7,
    ),
    SubscriptionPlan.PRO: PlanLimits(
        max_members=3,
        max_published_posts=None,
        can_schedule_posts=True,
        can_remove_branding=True,
        can_use_custom_domain=True,
        activity_log_days=90,
    ),
    SubscriptionPlan.TEAM: PlanLimits(
        max_members=15,
        max_published_posts=None,
        can_schedule_posts=True,
        can_remove_branding=True,
        can_use_custom_domain=True,
        activity_log_days=365,
    ),
}


def get_effective_plan(
    subscription: Optional[BlogSubscription],
    now: Optional[datetime] = None,
) -> SubscriptionPlan:
    """
    The plan a workspace's features should follow at `now`. A paid plan whose
    trial has run out, whose paid period has ended, or whose failed renewal
    has outlasted the grace period counts as Free. The row itself is left
    untouched — webhooks and billing actions are what change it.
    """
    if subscription is None:
        return SubscriptionPlan.FREE

    now = now or utc_now()
    plan = subscription.plan
    # A scheduled downgrade takes over once its date arrives, even before
    # the renewal webhook that confirms it has landed.
    change_at = as_utc(subscription.pending_change_at)
    if subscription.pending_plan and change_at and now >= change_at:
        plan = SubscriptionPlan(subscription.pending_plan)
    if plan == SubscriptionPlan.FREE:
        return SubscriptionPlan.FREE

    status = subscription.status
    period_end = as_utc(subscription.current_period_ends_at)
    grace = timedelta(days=settings.PAST_DUE_GRACE_DAYS)

    if status == SubscriptionStatus.TRIALING:
        trial_end = as_utc(subscription.trial_ends_at)
        return plan if trial_end and now < trial_end else SubscriptionPlan.FREE

    if status == SubscriptionStatus.ACTIVE:
        # No period end means a plan granted by hand (e.g. by a superadmin).
        # Otherwise allow the grace window: Paystack charges on the renewal
        # date and the webhook confirming it can land a little after.
        if period_end is None or now < period_end + grace:
            return plan
        return SubscriptionPlan.FREE

    if status == SubscriptionStatus.PAST_DUE:
        if period_end is not None and now < period_end + grace:
            return plan
        return SubscriptionPlan.FREE

    if status == SubscriptionStatus.CANCELED:
        # Cancelling stops renewal; what's already paid for stays usable.
        if period_end is not None and now < period_end:
            return plan
        return SubscriptionPlan.FREE

    return SubscriptionPlan.FREE


def get_plan_limits(subscription: Optional[BlogSubscription], now: Optional[datetime] = None) -> PlanLimits:
    return PLAN_LIMITS[get_effective_plan(subscription, now)]


# ── Enforcement ──────────────────────────────────────────────────────────────
# Limits only ever block adding something new. Nothing existing is removed or
# hidden when a workspace drops to a smaller plan.

def load_subscription(session: Session, blog_id: int) -> Optional[BlogSubscription]:
    return session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()


def get_blog_limits(session: Session, blog_id: int) -> PlanLimits:
    return get_plan_limits(load_subscription(session, blog_id))


def _upgrade_required(message: str) -> AuthorizationError:
    return AuthorizationError(ErrorCode.PLAN_UPGRADE_REQUIRED, message)


def ensure_member_capacity(
    session: Session,
    blog_id: int,
    include_pending_invites: bool = False,
    for_invitee: bool = False,
) -> None:
    """
    Block adding a member past the plan's limit. When sending an invitation,
    unaccepted invitations count too, so a Pro owner can't send ten invites
    against three seats; accepting one checks only real members.

    `for_invitee` is for the person accepting an invitation: they get
    WORKSPACE_FULL, which says nothing about the workspace's plan.
    """
    limit = get_blog_limits(session, blog_id).max_members
    if limit is None:
        return
    used = session.exec(
        select(func.count()).select_from(BlogMember).where(BlogMember.blog_id == blog_id)
    ).one()
    if include_pending_invites:
        used += session.exec(
            select(func.count()).select_from(BlogInvitation).where(
                BlogInvitation.blog_id == blog_id,
                BlogInvitation.accepted_at == None,  # noqa: E711
                BlogInvitation.expires_at > utc_now(),
            )
        ).one()
    if used >= limit:
        if for_invitee:
            raise AuthorizationError(ErrorCode.WORKSPACE_FULL)
        seats = "1 member" if limit == 1 else f"{limit} members"
        raise _upgrade_required(
            f"Your plan allows {seats}. Upgrade your plan in Settings → Billing to add more people."
        )


def ensure_can_publish(session: Session, blog_id: int) -> None:
    """Block publishing one more post past the plan's limit. Sample posts don't count."""
    limit = get_blog_limits(session, blog_id).max_published_posts
    if limit is None:
        return
    published = session.exec(
        select(func.count()).select_from(Post).where(
            Post.blog_id == blog_id,
            Post.status == PostStatus.PUBLISHED,
            Post.is_sample == False,  # noqa: E712
        )
    ).one()
    if published >= limit:
        raise _upgrade_required(
            f"The Free plan includes {limit} published posts. Upgrade to publish more — "
            "you can still save this post as a draft."
        )


def ensure_can_schedule(session: Session, blog_id: int) -> None:
    if not get_blog_limits(session, blog_id).can_schedule_posts:
        raise _upgrade_required(
            "Scheduled publishing is available on the Pro and Team plans."
        )


def ensure_can_use_custom_domain(session: Session, blog_id: int) -> None:
    """
    Block connecting or changing a custom domain on a plan without them. A domain
    connected on a paid plan keeps working after a downgrade, and can still be removed.
    """
    if not get_blog_limits(session, blog_id).can_use_custom_domain:
        raise _upgrade_required(
            "Custom domains are available on the Pro and Team plans."
        )
