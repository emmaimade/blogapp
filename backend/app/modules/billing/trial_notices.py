"""
Trial reminders, and tidying up after a trial ends unpaid.

A trial ending changes the effective plan on its own (see app.core.plans);
nothing here is needed for that. This job only tells people about it:

- the owner, 3 days before a card-less trial ends and again once it has;
- invitees whose pending invitation can no longer be accepted, because the
  workspace has no free seat — those invitations are cancelled.

Safe to run as often as you like: each notice is sent once per trial (checked
against the owner's notifications), and only trials that ended recently get
an "ended" notice, so a first run doesn't email every old trial.

Runs from the in-process scheduler locally, and from Vercel Cron in
production (GET /internal/cron/trial-notices), where the scheduler doesn't.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, func, select

import app.core.email as email
from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.email_templates import (
    get_invitation_cancelled_template,
    get_invitation_cancelled_template_text,
    get_trial_ended_template,
    get_trial_ended_template_text,
    get_trial_ending_template,
    get_trial_ending_template_text,
)
from app.core.plans import PLAN_LIMITS, get_blog_limits
from app.models import Blog, BlogInvitation, BlogMember, BlogRole, BlogSubscription, Notification, User
from app.models.blog import SubscriptionPlan, SubscriptionStatus
from app.modules.billing.service import BILLING_LINK, _notify_owners

logger = logging.getLogger(__name__)

TRIAL_ENDING_NOTICE = "billing_trial_ending"
TRIAL_EXPIRED_NOTICE = "billing_trial_expired"
WARN_DAYS_BEFORE_END = 3
# An "ended" notice is only worth sending close to the end; older trials are
# left alone so turning this job on doesn't email every trial that ever lapsed.
EXPIRED_NOTICE_WINDOW = timedelta(days=2)


@dataclass
class TrialNoticeRun:
    ending_notices: int = 0
    ended_notices: int = 0
    invitations_cancelled: int = 0


def _send(to: str, subject: str, html: str, text: str) -> None:
    try:
        email.send_smtp_email(to, subject, html, text)
    except Exception:  # one bad address mustn't stop the rest of the run
        logger.exception("trial notices: couldn't email %s", to)


def _billing_url(blog_id: int) -> str:
    return f"{settings.ADMIN_STUDIO_URL}{BILLING_LINK}?blog={blog_id}"


def _owners(session: Session, blog_id: int) -> list[User]:
    return session.exec(
        select(User).join(BlogMember, BlogMember.user_id == User.id).where(
            BlogMember.blog_id == blog_id, BlogMember.role == BlogRole.OWNER
        )
    ).all()


def _members_over_free_limit(session: Session, blog_id: int) -> int:
    """Non-owners who'd be paused on the Free plan."""
    members = session.exec(select(BlogMember).where(BlogMember.blog_id == blog_id)).all()
    owners = sum(1 for m in members if m.role == BlogRole.OWNER)
    others = len(members) - owners
    free_seats_for_others = max((PLAN_LIMITS[SubscriptionPlan.FREE].max_members or 0) - owners, 0)
    return max(others - free_seats_for_others, 0)


def _already_notified(session: Session, blog_id: int, type: str, since: datetime) -> bool:
    return session.exec(
        select(Notification.id).where(
            Notification.blog_id == blog_id, Notification.type == type, Notification.created_at >= since
        )
    ).first() is not None


def cancel_unusable_invitations(session: Session, blog_id: int, now: datetime) -> int:
    """
    Pending invitations to a workspace with no free seat can't be accepted;
    cancel them and tell the invitee, rather than leave a dead link that ends
    in "workspace full".
    """
    limit = get_blog_limits(session, blog_id).max_members
    if limit is None:
        return 0
    members = session.exec(select(func.count()).select_from(BlogMember).where(BlogMember.blog_id == blog_id)).one()
    if members < limit:
        return 0
    pending = session.exec(
        select(BlogInvitation).where(
            BlogInvitation.blog_id == blog_id,
            BlogInvitation.accepted_at == None,  # noqa: E711
            BlogInvitation.expires_at > now,
        )
    ).all()
    if not pending:
        return 0
    blog = session.get(Blog, blog_id)
    for invitation in pending:
        _send(
            invitation.email,
            f"Your invitation to {blog.name} is no longer available",
            get_invitation_cancelled_template(blog.name),
            get_invitation_cancelled_template_text(blog.name),
        )
        session.delete(invitation)
    return len(pending)


def run_trial_notices(session: Session, now: Optional[datetime] = None) -> TrialNoticeRun:
    now = now or utc_now()
    run = TrialNoticeRun()

    # Card-less trials only: adding a card during a trial makes the
    # subscription ACTIVE, with its first charge on the trial's end date.
    trials = session.exec(
        select(BlogSubscription).where(
            BlogSubscription.status == SubscriptionStatus.TRIALING.value,
            BlogSubscription.plan != SubscriptionPlan.FREE,
            BlogSubscription.trial_ends_at != None,  # noqa: E711
            BlogSubscription.paystack_subscription_code == None,  # noqa: E711
        )
    ).all()

    for subscription in trials:
        blog = session.get(Blog, subscription.blog_id)
        if not blog:
            continue
        trial_end = as_utc(subscription.trial_ends_at)
        plan_name = SubscriptionPlan(subscription.plan).value.title()
        billing_url = _billing_url(blog.id)

        if now < trial_end <= now + timedelta(days=WARN_DAYS_BEFORE_END):
            # Measured from the end date, so a trial a superadmin extends gets
            # a fresh reminder before its new end.
            since = trial_end - timedelta(days=WARN_DAYS_BEFORE_END + 1)
            if _already_notified(session, blog.id, TRIAL_ENDING_NOTICE, since):
                continue
            affected = _members_over_free_limit(session, blog.id)
            ends_on = trial_end.strftime("%d %b %Y")
            body = f"Add a payment method to keep {plan_name}. Otherwise {blog.name} moves to Free on {ends_on}."
            if affected:
                people = "1 teammate" if affected == 1 else f"{affected} teammates"
                body += f" {people} would become view-only."
            _notify_owners(
                session, blog.id, type=TRIAL_ENDING_NOTICE, title=f"Your {plan_name} trial ends on {ends_on}", body=body
            )
            for owner in _owners(session, blog.id):
                _send(
                    owner.email,
                    f"Your {plan_name} trial for {blog.name} ends on {ends_on}",
                    get_trial_ending_template(owner.first_name, blog.name, plan_name, ends_on, affected, billing_url),
                    get_trial_ending_template_text(owner.first_name, blog.name, plan_name, ends_on, affected, billing_url),
                )
            run.ending_notices += 1

        elif trial_end <= now and now - trial_end <= EXPIRED_NOTICE_WINDOW:
            if _already_notified(session, blog.id, TRIAL_EXPIRED_NOTICE, trial_end - timedelta(days=1)):
                continue
            affected = _members_over_free_limit(session, blog.id)
            cancelled = cancel_unusable_invitations(session, blog.id, now)
            run.invitations_cancelled += cancelled
            body = f"{blog.name} is now on the Free plan. Nothing has been deleted."
            if affected:
                people = "1 teammate is" if affected == 1 else f"{affected} teammates are"
                body += f" {people} view-only until you upgrade."
            _notify_owners(
                session, blog.id, type=TRIAL_EXPIRED_NOTICE, title=f"Your {plan_name} trial has ended", body=body
            )
            for owner in _owners(session, blog.id):
                _send(
                    owner.email,
                    f"Your {plan_name} trial for {blog.name} has ended",
                    get_trial_ended_template(owner.first_name, blog.name, plan_name, affected, cancelled, billing_url),
                    get_trial_ended_template_text(owner.first_name, blog.name, plan_name, affected, cancelled, billing_url),
                )
            run.ended_notices += 1

    session.commit()
    return run
