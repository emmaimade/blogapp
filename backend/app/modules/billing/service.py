"""
Workspace billing on Paystack.

Flow: checkout creates a pending PaymentTransaction and sends the owner to
Paystack. When they come back, `verify_payment` confirms the charge so the
plan switches on immediately; the webhook confirms the same charge (applied
once, keyed by reference) and carries everything that happens later —
the subscription being created, renewals, failed renewals, cancellation.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Callable, Optional

from fastapi import Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import (
    AppError,
    AuthenticationError,
    BadRequestError,
    ConflictError,
    ExternalServiceError,
    NotFoundError,
)
from app.core.notifications import add_notification
from app.core.plans import get_effective_plan
from app.models import (
    BillingInterval,
    Blog,
    BlogMember,
    BlogRole,
    BlogSubscription,
    PaymentEvent,
    PaymentTransaction,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.schemas.billing import (
    BillingOverview,
    CheckoutRequest,
    CheckoutResponse,
    PaymentTransactionRead,
)

from . import paystack

logger = logging.getLogger(__name__)

BILLING_LINK = "/admin/settings/billing"

# Adding a card during a trial: a small charge proves the card works and
# gives Paystack a reusable authorization, then it's refunded straight away.
# The plan's first real charge is scheduled for the day the trial ends.
CARD_CHECK_PREFIX = "inko-card-"
CARD_CHECK_KOBO = 5_000

# A payment has been applied once it's marked either of these.
_APPLIED = ("success", "refunded")


def is_card_check(reference: Optional[str]) -> bool:
    return bool(reference) and reference.startswith(CARD_CHECK_PREFIX)


def in_running_trial(subscription: BlogSubscription, now: Optional[datetime] = None) -> bool:
    trial_end = as_utc(subscription.trial_ends_at)
    return (
        subscription.status == SubscriptionStatus.TRIALING
        and not subscription.paystack_subscription_code
        and trial_end is not None
        and trial_end > (now or utc_now())
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create_subscription(session: Session, blog_id: int) -> BlogSubscription:
    subscription = session.exec(
        select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)
    ).first()
    if subscription is None:
        subscription = BlogSubscription(blog_id=blog_id, plan=SubscriptionPlan.FREE)
        session.add(subscription)
        session.flush()
    return subscription


def _subscription_by_code(session: Session, subscription_code: Optional[str]) -> Optional[BlogSubscription]:
    if not subscription_code:
        return None
    return session.exec(
        select(BlogSubscription).where(BlogSubscription.paystack_subscription_code == subscription_code)
    ).first()


def _notify_owners(session: Session, blog_id: int, *, type: str, title: str, body: str) -> None:
    owner_ids = session.exec(
        select(BlogMember.user_id).where(BlogMember.blog_id == blog_id, BlogMember.role == BlogRole.OWNER)
    ).all()
    for user_id in owner_ids:
        add_notification(
            session,
            user_id=user_id,
            blog_id=blog_id,
            type=type,
            title=title,
            body=body,
            link=f"{BILLING_LINK}?blog={blog_id}",
        )


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _period_end(start: datetime, interval: Optional[str]) -> datetime:
    # Only a fallback — the subscription.create / invoice.update webhooks
    # replace it with Paystack's own next_payment_date.
    return start + timedelta(days=365 if interval == BillingInterval.YEARLY else 30)


def _metadata(data: dict) -> dict:
    metadata = data.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except ValueError:
            return {}
    return metadata if isinstance(metadata, dict) else {}


def _format_naira(amount_kobo: int) -> str:
    return f"₦{amount_kobo / 100:,.0f}"


def remember_card(subscription: BlogSubscription, data: dict) -> None:
    """
    Keep the card a payment was made with, if Paystack says it can be charged
    again. Plan changes charge it directly and start replacement
    subscriptions on it.
    """
    authorization = data.get("authorization") or {}
    if authorization.get("reusable") and authorization.get("authorization_code"):
        subscription.paystack_authorization_code = authorization["authorization_code"]
    customer = data.get("customer") or {}
    if customer.get("email"):
        subscription.paystack_customer_email = customer["email"]
    if customer.get("customer_code"):
        subscription.paystack_customer_code = customer["customer_code"]


# ── Overview ─────────────────────────────────────────────────────────────────

def get_overview(blog: Blog, session: Session) -> BillingOverview:
    subscription = _get_or_create_subscription(session, blog.id)
    session.commit()
    transactions = session.exec(
        select(PaymentTransaction)
        .where(PaymentTransaction.blog_id == blog.id, PaymentTransaction.status != "pending")
        .order_by(PaymentTransaction.created_at.desc())
        .limit(50)
    ).all()
    return BillingOverview(
        blog_id=blog.id,
        plan=subscription.plan,
        effective_plan=get_effective_plan(subscription),
        status=subscription.status,
        billing_interval=subscription.billing_interval,
        trial_used=subscription.trial_used,
        trial_ends_at=subscription.trial_ends_at,
        current_period_ends_at=subscription.current_period_ends_at,
        cancelled_at=subscription.cancelled_at,
        has_paystack_subscription=bool(subscription.paystack_subscription_code),
        pending_plan=subscription.pending_plan,
        pending_interval=subscription.pending_interval,
        pending_change_at=subscription.pending_change_at,
        can_change_plan=can_change_in_place(subscription),
        trial_with_card=(
            is_card_check(subscription.last_payment_reference)
            and (as_utc(subscription.trial_ends_at) or utc_now()) > utc_now()
        ),
        transactions=[PaymentTransactionRead.model_validate(t) for t in transactions],
    )


def can_change_in_place(subscription: BlogSubscription) -> bool:
    # Imported here: plan_change builds on this module.
    from .plan_change import can_change_in_place as check

    return check(subscription)


# ── Checkout ─────────────────────────────────────────────────────────────────

def start_checkout(
    blog: Blog,
    payload: CheckoutRequest,
    session: Session,
    current_user: User,
    request: Optional[Request] = None,
) -> CheckoutResponse:
    if payload.plan == SubscriptionPlan.FREE:
        raise BadRequestError(ErrorCode.INVALID_INPUT, "The Free plan doesn't need a payment.")

    plan_code = paystack.plan_code_for(payload.plan, payload.interval)
    if not plan_code:
        raise ExternalServiceError(
            ErrorCode.BILLING_NOT_CONFIGURED,
            log_message=f"no Paystack plan code set for {payload.plan.value}/{payload.interval.value}",
        )

    subscription = _get_or_create_subscription(session, blog.id)
    if (
        subscription.paystack_subscription_code
        and subscription.status == SubscriptionStatus.ACTIVE
        and subscription.plan == payload.plan
        and subscription.billing_interval == payload.interval
    ):
        raise ConflictError(ErrorCode.ALREADY_SUBSCRIBED)

    card_check = in_running_trial(subscription)
    if card_check:
        # Nothing is owed until the trial ends: just save the card.
        amount_kobo, currency = CARD_CHECK_KOBO, "NGN"
        reference = f"{CARD_CHECK_PREFIX}{blog.id}-{uuid.uuid4().hex[:16]}"
    else:
        plan_data = paystack.fetch_plan(plan_code)
        amount_kobo = int(plan_data["amount"])
        currency = plan_data.get("currency") or "NGN"
        reference = f"inko-{blog.id}-{uuid.uuid4().hex[:16]}"

    init = paystack.initialize_transaction(
        email=current_user.email,
        amount_kobo=amount_kobo,
        plan_code=None if card_check else plan_code,
        reference=reference,
        callback_url=f"{settings.ADMIN_STUDIO_URL}{BILLING_LINK}/callback?blog={blog.id}",
        metadata={
            "blog_id": blog.id,
            "plan": payload.plan.value,
            "interval": payload.interval.value,
            "user_id": current_user.id,
            "card_check": card_check,
        },
    )

    session.add(
        PaymentTransaction(
            blog_id=blog.id,
            reference=reference,
            amount_kobo=amount_kobo,
            currency=currency,
            plan=payload.plan.value,
            billing_interval=payload.interval.value,
            status="pending",
        )
    )
    add_audit_log(
        session,
        action="billing.checkout_started",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog.id,
        actor=current_user,
        details={"plan": payload.plan.value, "interval": payload.interval.value, "reference": reference},
        request=request,
    )
    session.commit()
    return CheckoutResponse(authorization_url=init["authorization_url"], reference=reference)


def verify_payment(
    blog: Blog,
    reference: str,
    session: Session,
    current_user: User,
    request: Optional[Request] = None,
) -> BillingOverview:
    transaction = session.exec(
        select(PaymentTransaction).where(
            PaymentTransaction.reference == reference,
            PaymentTransaction.blog_id == blog.id,
        )
    ).first()
    if transaction is None:
        raise NotFoundError(ErrorCode.PAYMENT_NOT_FOUND)

    if transaction.status not in _APPLIED:
        data = paystack.verify_transaction(reference)
        if data.get("status") != "success":
            transaction.status = data.get("status") or "failed"
            session.add(transaction)
            session.commit()
            raise BadRequestError(ErrorCode.PAYMENT_NOT_SUCCESSFUL)
        _apply_successful_charge(session, data, actor=current_user, request=request)
    else:
        # Already applied (by the webhook, or an earlier visit to this page).
        # The lookup below only adds the subscription link, so a Paystack
        # hiccup here mustn't turn a paid page into an error.
        try:
            data = paystack.verify_transaction(reference)
        except AppError:
            logger.warning("billing: couldn't re-check charge %s; skipping subscription link", reference)
            data = None

    if data is not None:
        subscription = _get_or_create_subscription(session, transaction.blog_id)
        if subscription.last_payment_reference == transaction.reference:
            remember_card(subscription, data)
            session.add(subscription)
        _link_subscription_after_payment(session, transaction, data, request=request)
    session.commit()

    return get_overview(blog, session)


# Paystack creates the subscription a moment after the charge. Anything
# created well before the charge is an older subscription, not this one.
_SUBSCRIPTION_CLOCK_SKEW = timedelta(minutes=2)


def _link_subscription_after_payment(
    session: Session,
    transaction: PaymentTransaction,
    data: dict,
    request: Optional[Request] = None,
) -> None:
    """
    Save the Paystack subscription a checkout started, straight from the
    return page, so Cancel and Update card work at once without waiting for
    (or ever receiving) the subscription.create webhook. Best effort: if
    Paystack hasn't created it yet, the webhook links it later.
    """
    subscription = _get_or_create_subscription(session, transaction.blog_id)
    # Only for the payment the workspace is currently on: revisiting an
    # older payment's return page mustn't swap the subscription back.
    if subscription.last_payment_reference != transaction.reference or not transaction.billing_interval:
        return

    plan_code = paystack.plan_code_for(SubscriptionPlan(transaction.plan), BillingInterval(transaction.billing_interval))
    customer_id = (data.get("customer") or {}).get("id")
    if not plan_code or not customer_id:
        return

    try:
        candidates = paystack.list_subscriptions(customer_id)
    except AppError:
        logger.warning("billing: couldn't list subscriptions for charge %s", transaction.reference)
        return

    paid_at = as_utc(transaction.paid_at) or utc_now()
    matches = [
        item for item in candidates
        if (item.get("plan") or {}).get("plan_code") == plan_code
        and item.get("status") == "active"
        and item.get("subscription_code")
        and (_parse_datetime(item.get("createdAt")) or paid_at) >= paid_at - _SUBSCRIPTION_CLOCK_SKEW
    ]
    if not matches:
        return
    newest = max(matches, key=lambda item: _parse_datetime(item.get("createdAt")) or paid_at)
    code = newest["subscription_code"]

    if code == subscription.paystack_subscription_code:
        return
    linked_elsewhere = _subscription_by_code(session, code)
    if linked_elsewhere and linked_elsewhere.blog_id != subscription.blog_id:
        return

    _attach_subscription(
        session,
        subscription,
        code=code,
        email_token=newest.get("email_token"),
        next_payment_date=newest.get("next_payment_date"),
        source="return_page",
        request=request,
    )


def _attach_subscription(
    session: Session,
    subscription: BlogSubscription,
    *,
    code: str,
    email_token: Optional[str],
    next_payment_date: Optional[str],
    source: str,
    request: Optional[Request] = None,
) -> None:
    """Point the workspace at a new Paystack subscription, stopping the one it replaces."""
    old_code, old_token = subscription.paystack_subscription_code, subscription.paystack_email_token
    subscription.paystack_subscription_code = code
    subscription.paystack_email_token = email_token
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.cancelled_at = None
    next_payment = _parse_datetime(next_payment_date)
    if next_payment:
        subscription.current_period_ends_at = next_payment
    session.add(subscription)

    # Switching plan or interval starts a new Paystack subscription; stop the
    # old one so the owner isn't billed for both.
    if old_code and old_code != code and old_token:
        try:
            paystack.disable_subscription(old_code, old_token)
        except AppError:
            logger.exception("billing: couldn't disable replaced subscription %s", old_code)

    add_audit_log(
        session,
        action="billing.subscription_created",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=subscription.blog_id,
        details={
            "plan": subscription.plan.value,
            "interval": subscription.billing_interval,
            "replaced": old_code,
            "source": source,
        },
        request=request,
    )


def _apply_successful_charge(
    session: Session,
    data: dict,
    actor: Optional[User] = None,
    request: Optional[Request] = None,
) -> Optional[int]:
    """
    Activate the plan a checkout paid for. Safe to call twice for the same
    charge (the return redirect and the webhook both do): a transaction
    already marked successful is left alone.

    Renewal charges carry none of our metadata and have no pending
    transaction — those are recorded from invoice.update instead.
    """
    reference = data.get("reference")
    transaction = session.exec(
        select(PaymentTransaction).where(PaymentTransaction.reference == reference)
    ).first()
    if transaction is None:
        return None
    if transaction.status in _APPLIED:
        return transaction.blog_id

    amount = int(data.get("amount") or 0)
    if amount != transaction.amount_kobo:
        logger.warning(
            "billing: charge %s amount %s doesn't match expected %s; not activating",
            reference, amount, transaction.amount_kobo,
        )
        transaction.status = "amount_mismatch"
        session.add(transaction)
        return transaction.blog_id

    paid_at = _parse_datetime(data.get("paid_at") or data.get("paidAt")) or utc_now()
    transaction.status = "success"
    transaction.paid_at = paid_at
    session.add(transaction)

    subscription = _get_or_create_subscription(session, transaction.blog_id)
    if is_card_check(reference):
        _apply_card_check(session, transaction, subscription, data, actor=actor, request=request)
        return transaction.blog_id
    subscription.plan = SubscriptionPlan(transaction.plan)
    subscription.billing_interval = transaction.billing_interval
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.cancelled_at = None
    subscription.current_period_started_at = paid_at
    subscription.current_period_ends_at = _period_end(paid_at, transaction.billing_interval)
    subscription.last_payment_reference = reference
    subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    remember_card(subscription, data)
    session.add(subscription)

    add_audit_log(
        session,
        action="billing.payment_succeeded",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=transaction.blog_id,
        actor=actor,
        details={
            "plan": transaction.plan,
            "interval": transaction.billing_interval,
            "reference": reference,
            "amount_kobo": amount,
        },
        request=request,
    )
    _notify_owners(
        session,
        transaction.blog_id,
        type="billing_payment_succeeded",
        title=f"You're on the {transaction.plan.title()} plan",
        body=f"We received your payment of {_format_naira(amount)}.",
    )
    return transaction.blog_id


def _apply_card_check(
    session: Session,
    transaction: PaymentTransaction,
    subscription: BlogSubscription,
    data: dict,
    actor: Optional[User] = None,
    request: Optional[Request] = None,
) -> None:
    """
    The card was added during a trial: save it, refund the check, and start
    the subscription so its first charge falls on the day the trial ends.
    Raises if Paystack won't create the subscription, so the webhook retries.
    """
    remember_card(subscription, data)
    plan = SubscriptionPlan(transaction.plan)
    interval = BillingInterval(transaction.billing_interval)
    now = utc_now()
    trial_end = as_utc(subscription.trial_ends_at)
    first_charge = trial_end if trial_end and trial_end > now else now + timedelta(minutes=5)

    plan_code = paystack.plan_code_for(plan, interval)
    if not plan_code or not subscription.paystack_authorization_code:
        raise ExternalServiceError(
            ErrorCode.PAYMENT_PROVIDER_ERROR,
            log_message=f"billing: card check {transaction.reference} left no reusable card or plan code",
        )
    created = paystack.create_subscription(
        customer=subscription.paystack_customer_code or subscription.paystack_customer_email,
        plan_code=plan_code,
        authorization_code=subscription.paystack_authorization_code,
        start_date=first_charge,
    )

    try:
        paystack.refund_transaction(transaction.reference)
        transaction.status = "refunded"
    except AppError:
        logger.exception("billing: couldn't refund card check %s; refund it from the Paystack dashboard", transaction.reference)
    session.add(transaction)

    subscription.plan = plan
    subscription.billing_interval = interval.value
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.cancelled_at = None
    subscription.paystack_subscription_code = created.get("subscription_code")
    subscription.paystack_email_token = created.get("email_token")
    # Paid-for time starts when the trial ends; until then nothing has been paid.
    subscription.current_period_started_at = now
    subscription.current_period_ends_at = first_charge
    subscription.last_payment_reference = transaction.reference
    subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    session.add(subscription)

    add_audit_log(
        session,
        action="billing.card_added",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=transaction.blog_id,
        actor=actor,
        details={"plan": plan.value, "interval": interval.value, "first_charge": first_charge.isoformat()},
        request=request,
    )
    _notify_owners(
        session,
        transaction.blog_id,
        type="billing_card_added",
        title=f"Card saved for your {plan.value.title()} plan",
        body=f"Your trial continues. Your first payment is on {first_charge.strftime('%d %b %Y')}.",
    )


# ── Cancel & manage ──────────────────────────────────────────────────────────

def cancel_subscription(
    blog: Blog,
    session: Session,
    current_user: User,
    request: Optional[Request] = None,
) -> BillingOverview:
    subscription = _get_or_create_subscription(session, blog.id)

    if subscription.status == SubscriptionStatus.TRIALING and not subscription.paystack_subscription_code:
        # A trial has no card and nothing to stop at Paystack — just end it.
        previous_plan = subscription.plan
        subscription.plan = SubscriptionPlan.FREE
        subscription.status = SubscriptionStatus.ACTIVE.value
        subscription.trial_ends_at = utc_now()
        details = {"plan": previous_plan.value, "trial": True}
    elif (
        subscription.paystack_subscription_code
        and subscription.paystack_email_token
        and subscription.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
    ):
        paystack.disable_subscription(subscription.paystack_subscription_code, subscription.paystack_email_token)
        subscription.status = SubscriptionStatus.CANCELED.value
        subscription.cancelled_at = utc_now()
        # The current subscription may be a scheduled downgrade's; cancelling
        # stops that too, so the plan simply ends with the paid period.
        subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
        details = {"plan": subscription.plan.value, "access_until": subscription.current_period_ends_at.isoformat() if subscription.current_period_ends_at else None}
    else:
        raise BadRequestError(ErrorCode.NO_ACTIVE_SUBSCRIPTION)

    session.add(subscription)
    add_audit_log(
        session,
        action="billing.subscription_canceled",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog.id,
        actor=current_user,
        details=details,
        request=request,
    )
    session.commit()
    return get_overview(blog, session)


def get_manage_link(blog: Blog, session: Session) -> str:
    subscription = _get_or_create_subscription(session, blog.id)
    if not subscription.paystack_subscription_code:
        raise BadRequestError(ErrorCode.NO_ACTIVE_SUBSCRIPTION)
    return paystack.get_manage_link(subscription.paystack_subscription_code)


# ── Webhook ──────────────────────────────────────────────────────────────────

def _event_key(event_type: str, data: dict) -> str:
    if event_type == "charge.success" and data.get("reference"):
        return f"{event_type}:{data['reference']}"
    if event_type.startswith("subscription.") and data.get("subscription_code"):
        return f"{event_type}:{data['subscription_code']}"
    if event_type.startswith("invoice.") and data.get("invoice_code"):
        # An invoice is updated more than once (created, then paid or failed).
        return f"{event_type}:{data['invoice_code']}:{data.get('status')}:{data.get('paid')}"
    if data.get("id") is not None:
        return f"{event_type}:{data['id']}"
    return f"{event_type}:{uuid.uuid5(uuid.NAMESPACE_OID, json.dumps(data, sort_keys=True))}"


def _on_subscription_create(session: Session, data: dict, request: Optional[Request]) -> Optional[int]:
    code = data.get("subscription_code")
    existing = _subscription_by_code(session, code)
    if existing:
        return existing.blog_id

    mapped = paystack.plan_for_code((data.get("plan") or {}).get("plan_code"))
    customer_code = (data.get("customer") or {}).get("customer_code")
    if not mapped or not customer_code:
        return None
    plan, interval = mapped

    # The subscription carries none of our metadata, so match it to the
    # workspace whose charge for this customer + plan was just applied.
    # Paystack customers are per email, and one owner can run several
    # workspaces, hence the plan match and newest-first.
    subscription = session.exec(
        select(BlogSubscription)
        .where(
            BlogSubscription.paystack_customer_code == customer_code,
            BlogSubscription.plan == plan,
            BlogSubscription.billing_interval == interval.value,
        )
        .order_by(BlogSubscription.updated_at.desc())
    ).first()
    if subscription is None:
        # charge.success hasn't landed yet. Failing makes Paystack redeliver
        # this event later, by which point it will have.
        raise ExternalServiceError(
            ErrorCode.SERVICE_UNAVAILABLE,
            log_message=f"billing: no workspace yet for subscription {code}; asking Paystack to retry",
        )

    _attach_subscription(
        session,
        subscription,
        code=code,
        email_token=data.get("email_token"),
        next_payment_date=data.get("next_payment_date"),
        source="webhook",
        request=request,
    )
    return subscription.blog_id


def _on_invoice_update(session: Session, data: dict, request: Optional[Request]) -> Optional[int]:
    sub_data = data.get("subscription") or {}
    subscription = _subscription_by_code(session, sub_data.get("subscription_code"))
    if subscription is None or not (data.get("paid") or data.get("status") == "success"):
        return subscription.blog_id if subscription else None

    tx_data = data.get("transaction") or {}
    reference = tx_data.get("reference")
    paid_at = _parse_datetime(data.get("paid_at")) or utc_now()
    amount = int(tx_data.get("amount") or data.get("amount") or 0)

    # The first charge of a scheduled downgrade's subscription: the new plan
    # starts now. (A day's slack for Paystack charging a little early.)
    change_at = as_utc(subscription.pending_change_at)
    if subscription.pending_plan and change_at and as_utc(paid_at) >= change_at - timedelta(days=1):
        subscription.plan = SubscriptionPlan(subscription.pending_plan)
        subscription.billing_interval = subscription.pending_interval
        subscription.pending_plan = subscription.pending_interval = subscription.pending_change_at = None
    remember_card(subscription, data)

    if reference and not session.exec(
        select(PaymentTransaction).where(PaymentTransaction.reference == reference)
    ).first():
        session.add(
            PaymentTransaction(
                blog_id=subscription.blog_id,
                reference=reference,
                amount_kobo=amount,
                currency=tx_data.get("currency") or "NGN",
                plan=subscription.plan.value,
                billing_interval=subscription.billing_interval,
                status="success",
                paid_at=paid_at,
            )
        )
        subscription.last_payment_reference = reference

    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.current_period_started_at = paid_at
    subscription.current_period_ends_at = (
        _parse_datetime(sub_data.get("next_payment_date"))
        or _period_end(paid_at, subscription.billing_interval)
    )
    session.add(subscription)
    add_audit_log(
        session,
        action="billing.subscription_renewed",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=subscription.blog_id,
        details={"reference": reference, "amount_kobo": amount},
        request=request,
    )
    return subscription.blog_id


def _on_invoice_payment_failed(session: Session, data: dict, request: Optional[Request]) -> Optional[int]:
    subscription = _subscription_by_code(session, (data.get("subscription") or {}).get("subscription_code"))
    if subscription is None:
        return None
    subscription.status = SubscriptionStatus.PAST_DUE.value
    session.add(subscription)
    add_audit_log(
        session,
        action="billing.payment_failed",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=subscription.blog_id,
        details={"invoice": data.get("invoice_code")},
        request=request,
    )
    _notify_owners(
        session,
        subscription.blog_id,
        type="billing_payment_failed",
        title="Your payment didn't go through",
        body=(
            f"We couldn't renew your {subscription.plan.value.title()} plan. Update your card within "
            f"{settings.PAST_DUE_GRACE_DAYS} days to keep your plan's features."
        ),
    )
    return subscription.blog_id


def _on_subscription_ended(session: Session, data: dict, request: Optional[Request]) -> Optional[int]:
    # Only the workspace's current subscription counts — an old one being
    # disabled after a plan switch must not cancel the new plan.
    subscription = _subscription_by_code(session, data.get("subscription_code"))
    if subscription is None:
        return None
    if subscription.status != SubscriptionStatus.CANCELED:
        subscription.status = SubscriptionStatus.CANCELED.value
        subscription.cancelled_at = utc_now()
        session.add(subscription)
        add_audit_log(
            session,
            action="billing.subscription_canceled",
            resource_type="subscription",
            resource_id=subscription.id,
            blog_id=subscription.blog_id,
            details={"source": "paystack", "status": data.get("status")},
            request=request,
        )
    return subscription.blog_id


_HANDLERS: dict[str, Callable[[Session, dict, Optional[Request]], Optional[int]]] = {
    "charge.success": lambda session, data, request: _apply_successful_charge(session, data, request=request),
    "subscription.create": _on_subscription_create,
    "invoice.update": _on_invoice_update,
    "invoice.payment_failed": _on_invoice_payment_failed,
    "subscription.not_renew": _on_subscription_ended,
    "subscription.disable": _on_subscription_ended,
}


def handle_webhook(raw_body: bytes, signature: Optional[str], session: Session, request: Optional[Request] = None) -> None:
    if not paystack.verify_signature(raw_body, signature):
        raise AuthenticationError(ErrorCode.INVALID_WEBHOOK_SIGNATURE)

    try:
        event = json.loads(raw_body)
    except ValueError:
        raise BadRequestError(ErrorCode.INVALID_INPUT)
    event_type = event.get("event") or "unknown"
    data = event.get("data") or {}

    key = _event_key(event_type, data)
    if session.exec(select(PaymentEvent).where(PaymentEvent.event_key == key)).first():
        return

    handler = _HANDLERS.get(event_type)
    blog_id = handler(session, data, request) if handler else None

    session.add(PaymentEvent(event_key=key, event_type=event_type, blog_id=blog_id, payload=raw_body.decode()))
    try:
        session.commit()
    except IntegrityError:
        # The same event delivered twice at once — the other delivery won.
        session.rollback()
