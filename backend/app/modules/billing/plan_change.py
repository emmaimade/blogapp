"""
Changing plan on a workspace that already pays through Paystack, the way
subscription products usually do it:

- Upgrade (higher tier, or monthly → yearly): the new plan applies now. The
  owner pays the new price less credit for the unused part of the current
  period, charged to the saved card. The replacement subscription's first
  renewal is one full new period from now — later still if the credit covers
  more than the new price.
- Downgrade (lower tier, or yearly → monthly): nothing is charged and the
  current plan runs to the end of the paid period; the new plan starts then.
  The owner can undo it until that date.
- Resume (picking the same plan after cancelling): renewal restarts on the
  original date, with nothing charged now.

Paystack has no proration of its own, so the replacement is always a new
Paystack subscription with a `start_date`, and the old one is disabled.
"""
import logging
import uuid
from calendar import monthrange
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Request
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError, BadRequestError, ConflictError, ExternalServiceError
from app.models import (
    BillingInterval,
    Blog,
    BlogSubscription,
    PaymentTransaction,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.schemas.billing import BillingOverview, ChangePreview, CheckoutRequest

from . import paystack
from .service import _format_naira, _get_or_create_subscription, _notify_owners, get_overview, is_card_check, remember_card

logger = logging.getLogger(__name__)

_TIER = {SubscriptionPlan.PRO: 1, SubscriptionPlan.TEAM: 2}
_INTERVAL_RANK = {BillingInterval.MONTHLY: 1, BillingInterval.YEARLY: 2}

# Paystack won't take tiny card charges; an upgrade costing less than this
# after credit is simply not charged.
MIN_CHARGE_KOBO = 10_000


def add_period(start: datetime, interval: BillingInterval) -> datetime:
    """One billing period after `start`: same day next month/year, clamped to month length."""
    months = 12 if interval == BillingInterval.YEARLY else 1
    month_index = start.month - 1 + months
    year, month = start.year + month_index // 12, month_index % 12 + 1
    day = min(start.day, monthrange(year, month)[1])
    return start.replace(year=year, month=month, day=day)


@dataclass
class Quote:
    kind: str  # upgrade, downgrade, resume, or trial (switch before the first charge)
    plan: SubscriptionPlan
    interval: BillingInterval
    charge_now_kobo: int
    credit_kobo: int
    effective_at: datetime
    next_charge_at: datetime
    next_charge_kobo: int


def can_change_in_place(subscription: Optional[BlogSubscription], now: Optional[datetime] = None) -> bool:
    """
    A paid Paystack plan with time left that can be changed on the saved card.
    Trials, granted plans, lapsed plans and failed renewals go through checkout.
    """
    if subscription is None or subscription.plan == SubscriptionPlan.FREE or not subscription.billing_interval:
        return False
    if not subscription.paystack_subscription_code:
        return False
    if not (subscription.paystack_authorization_code or subscription.last_payment_reference):
        return False
    period_end = as_utc(subscription.current_period_ends_at)
    if period_end is None or period_end <= (now or utc_now()):
        return False
    return subscription.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED)


def _classify(subscription: BlogSubscription, plan: SubscriptionPlan, interval: BillingInterval) -> str:
    current_interval = BillingInterval(subscription.billing_interval)
    if plan == subscription.plan and interval == current_interval:
        if subscription.status == SubscriptionStatus.CANCELED or subscription.pending_plan:
            return "resume"
        raise ConflictError(ErrorCode.ALREADY_SUBSCRIBED)
    if _TIER[plan] != _TIER[subscription.plan]:
        return "upgrade" if _TIER[plan] > _TIER[subscription.plan] else "downgrade"
    return "upgrade" if _INTERVAL_RANK[interval] > _INTERVAL_RANK[current_interval] else "downgrade"


def _plan_code(plan: SubscriptionPlan, interval: BillingInterval) -> str:
    code = paystack.plan_code_for(plan, interval)
    if not code:
        raise ExternalServiceError(
            ErrorCode.BILLING_NOT_CONFIGURED,
            log_message=f"no Paystack plan code set for {plan.value}/{interval.value}",
        )
    return code


def _price(plan: SubscriptionPlan, interval: BillingInterval) -> int:
    return int(paystack.fetch_plan(_plan_code(plan, interval))["amount"])


def _current_payment(session: Session, subscription: BlogSubscription) -> Optional[PaymentTransaction]:
    if not subscription.last_payment_reference:
        return None
    return session.exec(
        select(PaymentTransaction).where(
            PaymentTransaction.reference == subscription.last_payment_reference,
            PaymentTransaction.status == "success",
        )
    ).first()


def _credit(session: Session, subscription: BlogSubscription, now: datetime) -> int:
    """Value of the unused part of the current paid period."""
    period_end = as_utc(subscription.current_period_ends_at)
    interval = BillingInterval(subscription.billing_interval)
    payment = _current_payment(session, subscription)
    paid = payment.amount_kobo if payment else _price(subscription.plan, interval)

    period_start = as_utc(subscription.current_period_started_at) or (
        as_utc(payment.paid_at) if payment and payment.paid_at else None
    )
    if period_start is None or period_start >= period_end:
        # No record of the start: assume a whole period ending at period_end.
        period_start = period_end - timedelta(days=365 if interval == BillingInterval.YEARLY else 30)

    total = (period_end - period_start).total_seconds()
    remaining = max(0.0, min(total, (period_end - now).total_seconds()))
    return int(paid * remaining / total) if total > 0 else 0


def quote_change(
    session: Session,
    subscription: BlogSubscription,
    plan: SubscriptionPlan,
    interval: BillingInterval,
    now: Optional[datetime] = None,
) -> Quote:
    if plan == SubscriptionPlan.FREE:
        raise BadRequestError(ErrorCode.INVALID_INPUT, "To move to Free, cancel your plan instead.")
    now = now or utc_now()
    if not can_change_in_place(subscription, now):
        raise BadRequestError(ErrorCode.PAYMENT_METHOD_REQUIRED)

    kind = _classify(subscription, plan, interval)
    period_end = as_utc(subscription.current_period_ends_at)
    new_price = _price(plan, interval)

    if kind != "resume" and is_card_check(subscription.last_payment_reference):
        # Still in a trial that has a card on file: nothing has been paid, so
        # there's nothing to prorate. Any switch applies now and the first
        # charge stays on the trial's last day.
        return Quote("trial", plan, interval, 0, 0, now, period_end, new_price)

    if kind != "upgrade":
        return Quote(kind, plan, interval, 0, 0, period_end if kind == "downgrade" else now, period_end, new_price)

    credit = _credit(session, subscription, now)
    new_period_end = add_period(now, interval)
    if credit >= new_price:
        # The credit pays for more than one new period: no charge, and the
        # first renewal moves out by however much time the leftover buys.
        covered = (new_period_end - now) * (credit / new_price)
        return Quote(kind, plan, interval, 0, credit, now, now + covered, new_price)

    charge = new_price - credit
    if charge < MIN_CHARGE_KOBO:
        charge = 0
    return Quote(kind, plan, interval, charge, credit, now, new_period_end, new_price)


def _to_preview(quote: Quote) -> ChangePreview:
    return ChangePreview(**quote.__dict__)


def preview_change(blog: Blog, payload: CheckoutRequest, session: Session) -> ChangePreview:
    subscription = _get_or_create_subscription(session, blog.id)
    return _to_preview(quote_change(session, subscription, payload.plan, payload.interval))


def _load_card(session: Session, subscription: BlogSubscription) -> tuple[str, str]:
    """The saved card and its email, fetched once from the last payment for workspaces that predate saving it."""
    if not (subscription.paystack_authorization_code and subscription.paystack_customer_email) and subscription.last_payment_reference:
        try:
            remember_card(subscription, paystack.verify_transaction(subscription.last_payment_reference))
        except AppError:
            logger.warning("billing: couldn't fetch the card for workspace %s", subscription.blog_id)
    if not (subscription.paystack_authorization_code and subscription.paystack_customer_email):
        raise BadRequestError(ErrorCode.PAYMENT_METHOD_REQUIRED)
    return subscription.paystack_authorization_code, subscription.paystack_customer_email


def _start_subscription(subscription: BlogSubscription, plan: SubscriptionPlan, interval: BillingInterval, start: datetime) -> dict:
    authorization, email = subscription.paystack_authorization_code, subscription.paystack_customer_email
    return paystack.create_subscription(
        customer=subscription.paystack_customer_code or email,
        plan_code=_plan_code(plan, interval),
        authorization_code=authorization,
        start_date=start,
    )


def _stop_old(code: Optional[str], token: Optional[str]) -> None:
    if not (code and token):
        return
    try:
        paystack.disable_subscription(code, token)
    except AppError:
        # Usually already disabled (e.g. after a cancel). Logged in case it isn't.
        logger.warning("billing: couldn't disable replaced subscription %s", code)


def apply_change(
    blog: Blog,
    payload: CheckoutRequest,
    session: Session,
    current_user: User,
    request: Optional[Request] = None,
) -> BillingOverview:
    subscription = _get_or_create_subscription(session, blog.id)
    quote = quote_change(session, subscription, payload.plan, payload.interval)
    authorization, email = _load_card(session, subscription)
    old_code, old_token = subscription.paystack_subscription_code, subscription.paystack_email_token
    old_was_renewing = subscription.status == SubscriptionStatus.ACTIVE
    previous_plan, previous_interval = subscription.plan, subscription.billing_interval
    now = utc_now()

    if quote.kind == "upgrade" and quote.charge_now_kobo > 0:
        reference = f"inko-{blog.id}-{uuid.uuid4().hex[:16]}"
        charge = paystack.charge_authorization(
            email=email,
            amount_kobo=quote.charge_now_kobo,
            authorization_code=authorization,
            reference=reference,
            metadata={"blog_id": blog.id, "plan": quote.plan.value, "interval": quote.interval.value, "kind": "upgrade"},
        )
        if charge.get("status") != "success":
            raise BadRequestError(ErrorCode.PAYMENT_NOT_SUCCESSFUL)
        session.add(
            PaymentTransaction(
                blog_id=blog.id,
                reference=reference,
                amount_kobo=quote.charge_now_kobo,
                currency="NGN",
                plan=quote.plan.value,
                billing_interval=quote.interval.value,
                status="success",
                paid_at=now,
            )
        )
        subscription.last_payment_reference = reference

    # For an upgrade the charge has already gone through, so a failure to
    # create the replacement subscription mustn't undo the upgrade; it's
    # logged and the owner is asked to renew from Billing when the period ends.
    try:
        created = _start_subscription(subscription, quote.plan, quote.interval, quote.next_charge_at)
    except AppError:
        if quote.kind != "upgrade" or quote.charge_now_kobo == 0:
            raise
        logger.exception("billing: upgrade charged but no replacement subscription for workspace %s", blog.id)
        created = {}

    # A cancelled plan's subscription is already stopped; a renewing one (or
    # a scheduled downgrade's) is replaced by the one just created.
    if old_was_renewing:
        _stop_old(old_code, old_token)

    subscription.paystack_subscription_code = created.get("subscription_code")
    subscription.paystack_email_token = created.get("email_token")
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.cancelled_at = None

    if quote.kind == "upgrade":
        subscription.plan = quote.plan
        subscription.billing_interval = quote.interval.value
        subscription.current_period_started_at = now
        subscription.current_period_ends_at = quote.next_charge_at
        subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    elif quote.kind == "trial":
        subscription.plan = quote.plan
        subscription.billing_interval = quote.interval.value
        subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    elif quote.kind == "downgrade":
        subscription.pending_plan = quote.plan.value
        subscription.pending_interval = quote.interval.value
        subscription.pending_change_at = quote.effective_at
    else:  # resume
        subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    session.add(subscription)

    add_audit_log(
        session,
        action="billing.plan_changed",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog.id,
        actor=current_user,
        details={
            "kind": quote.kind,
            "from": f"{previous_plan.value}/{previous_interval}",
            "to": f"{quote.plan.value}/{quote.interval.value}",
            "charged_kobo": quote.charge_now_kobo,
            "credit_kobo": quote.credit_kobo,
            "effective_at": quote.effective_at.isoformat(),
        },
        request=request,
    )
    plan_name = quote.plan.value.title()
    if quote.kind == "upgrade":
        title = f"You're on the {plan_name} plan"
        body = (
            f"We charged {_format_naira(quote.charge_now_kobo)} for the rest of this period."
            if quote.charge_now_kobo
            else "Your unused credit covered the change, so there was nothing to pay."
        )
    elif quote.kind == "downgrade":
        title = f"Switching to {plan_name} on {quote.effective_at.strftime('%d %b %Y')}"
        body = "You keep your current plan until then."
    elif quote.kind == "trial":
        title = f"Your trial is now on {plan_name}"
        body = f"Your first payment is on {quote.next_charge_at.strftime('%d %b %Y')}."
    else:
        title = f"Your {plan_name} plan will renew"
        body = f"Next payment on {quote.next_charge_at.strftime('%d %b %Y')}."
    _notify_owners(session, blog.id, type="billing_plan_changed", title=title, body=body)

    session.commit()
    return get_overview(blog, session)


def undo_pending_change(
    blog: Blog,
    session: Session,
    current_user: User,
    request: Optional[Request] = None,
) -> BillingOverview:
    """Keep the current plan: replace the scheduled subscription with one on the current plan."""
    subscription = _get_or_create_subscription(session, blog.id)
    if not subscription.pending_plan:
        raise BadRequestError(ErrorCode.NO_PENDING_CHANGE)
    _load_card(session, subscription)

    period_end = as_utc(subscription.current_period_ends_at)
    created = _start_subscription(subscription, subscription.plan, BillingInterval(subscription.billing_interval), period_end)
    _stop_old(subscription.paystack_subscription_code, subscription.paystack_email_token)

    undone = subscription.pending_plan
    subscription.paystack_subscription_code = created.get("subscription_code")
    subscription.paystack_email_token = created.get("email_token")
    subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    session.add(subscription)
    add_audit_log(
        session,
        action="billing.plan_change_undone",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog.id,
        actor=current_user,
        details={"kept": subscription.plan.value, "dropped": undone},
        request=request,
    )
    session.commit()
    return get_overview(blog, session)
