"""
Superadmin view of every workspace's subscription, plus the two manual
levers: extending a trial and granting a plan without payment.

Both levers refuse to touch a workspace that is paying through a renewing
Paystack subscription — changing the plan here wouldn't stop Paystack
charging the owner for the old one.
"""
from datetime import timedelta
from typing import Optional

from fastapi import Request
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.plans import get_effective_plan
from app.models import (
    BillingInterval,
    Blog,
    BlogSubscription,
    PaymentTransaction,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.schemas.billing import (
    AdminSubscriptionDetail,
    AdminSubscriptionList,
    AdminSubscriptionRow,
    AdminSubscriptionSummary,
    EndTrialRequest,
    ExtendTrialRequest,
    GrantPlanRequest,
    PaymentTransactionRead,
)

from .service import _get_or_create_subscription, _notify_owners, is_card_check


def _is_renewing_on_paystack(subscription: Optional[BlogSubscription]) -> bool:
    return bool(
        subscription
        and subscription.paystack_subscription_code
        and subscription.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
    )


def _category(subscription: Optional[BlogSubscription], effective: SubscriptionPlan) -> str:
    if subscription is None:
        return "free"
    if subscription.status == SubscriptionStatus.PAST_DUE:
        return "past_due"
    if effective == SubscriptionPlan.FREE:
        return "free"
    if subscription.status == SubscriptionStatus.TRIALING:
        return "trialing"
    trial_end = as_utc(subscription.trial_ends_at)
    if trial_end and trial_end > utc_now() and is_card_check(subscription.last_payment_reference):
        # Card on file, first charge on the trial's last day.
        return "trialing"
    if subscription.status == SubscriptionStatus.CANCELED:
        return "canceled"
    return "paying" if subscription.paystack_subscription_code else "granted"


def _latest_payments(session: Session, blog_ids: Optional[list[int]] = None) -> dict[int, PaymentTransaction]:
    query = select(PaymentTransaction).where(PaymentTransaction.status == "success")
    if blog_ids is not None:
        query = query.where(PaymentTransaction.blog_id.in_(blog_ids))
    latest: dict[int, PaymentTransaction] = {}
    for tx in session.exec(query).all():
        current = latest.get(tx.blog_id)
        if current is None or (as_utc(tx.paid_at) or as_utc(tx.created_at)) > (as_utc(current.paid_at) or as_utc(current.created_at)):
            latest[tx.blog_id] = tx
    return latest


def _row(
    blog: Blog,
    owner_email: Optional[str],
    subscription: Optional[BlogSubscription],
    last_payment: Optional[PaymentTransaction],
) -> dict:
    effective = get_effective_plan(subscription)
    category = _category(subscription, effective)

    monthly_value = 0
    if category in ("paying", "past_due") and last_payment is not None:
        monthly_value = last_payment.amount_kobo
        if last_payment.billing_interval == BillingInterval.YEARLY:
            monthly_value //= 12

    return dict(
        blog_id=blog.id,
        blog_name=blog.name,
        owner_email=owner_email,
        plan=subscription.plan if subscription else SubscriptionPlan.FREE,
        effective_plan=effective,
        status=subscription.status if subscription else SubscriptionStatus.ACTIVE.value,
        billing_interval=subscription.billing_interval if subscription else None,
        trial_used=subscription.trial_used if subscription else False,
        trial_ends_at=subscription.trial_ends_at if subscription else None,
        current_period_ends_at=subscription.current_period_ends_at if subscription else None,
        cancelled_at=subscription.cancelled_at if subscription else None,
        has_paystack_subscription=bool(subscription and subscription.paystack_subscription_code),
        monthly_value_kobo=monthly_value,
        last_payment_at=(last_payment.paid_at or last_payment.created_at) if last_payment else None,
        category=category,
    )


def list_subscriptions(session: Session) -> AdminSubscriptionList:
    # Every workspace, including ones that have never had a subscription row
    # (they're on Free).
    rows = session.exec(
        select(Blog, User.email, BlogSubscription)
        .join(User, User.id == Blog.owner_id, isouter=True)
        .join(BlogSubscription, BlogSubscription.blog_id == Blog.id, isouter=True)
        .order_by(Blog.name)
    ).all()
    payments = _latest_payments(session)

    items = [
        AdminSubscriptionRow(**_row(blog, email, subscription, payments.get(blog.id)))
        for blog, email, subscription in rows
    ]
    counts = {key: 0 for key in ("paying", "trialing", "past_due", "canceled", "granted", "free")}
    for item in items:
        counts[item.category] += 1

    return AdminSubscriptionList(
        summary=AdminSubscriptionSummary(mrr_kobo=sum(i.monthly_value_kobo for i in items), **counts),
        subscriptions=items,
    )


def _load(session: Session, blog_id: int) -> tuple[Blog, Optional[str]]:
    blog = session.get(Blog, blog_id)
    if blog is None:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    owner = session.get(User, blog.owner_id) if blog.owner_id else None
    return blog, owner.email if owner else None


def get_subscription_detail(session: Session, blog_id: int) -> AdminSubscriptionDetail:
    blog, owner_email = _load(session, blog_id)
    subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
    transactions = session.exec(
        select(PaymentTransaction)
        .where(PaymentTransaction.blog_id == blog_id, PaymentTransaction.status != "pending")
        .order_by(PaymentTransaction.created_at.desc())
        .limit(50)
    ).all()
    latest = _latest_payments(session, [blog_id]).get(blog_id)
    return AdminSubscriptionDetail(
        **_row(blog, owner_email, subscription, latest),
        transactions=[PaymentTransactionRead.model_validate(t) for t in transactions],
    )


def _refuse_if_paying(subscription: BlogSubscription) -> None:
    if _is_renewing_on_paystack(subscription):
        raise ConflictError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "This workspace pays through Paystack. Its owner needs to cancel that subscription "
            "before its plan can be changed here.",
        )


def extend_trial(
    session: Session,
    blog_id: int,
    payload: ExtendTrialRequest,
    actor: User,
    request: Optional[Request] = None,
) -> AdminSubscriptionDetail:
    _load(session, blog_id)
    subscription = _get_or_create_subscription(session, blog_id)
    _refuse_if_paying(subscription)

    plan = payload.plan or (subscription.plan if subscription.plan != SubscriptionPlan.FREE else None)
    if plan is None or plan == SubscriptionPlan.FREE:
        raise BadRequestError(ErrorCode.INVALID_INPUT, "Choose Pro or Team for the trial.")

    now = utc_now()
    trial_end = as_utc(subscription.trial_ends_at)
    # Extending a running trial adds to it; otherwise the trial starts now.
    start = trial_end if subscription.status == SubscriptionStatus.TRIALING and trial_end and trial_end > now else now
    previous_end = subscription.trial_ends_at

    subscription.plan = plan
    subscription.status = SubscriptionStatus.TRIALING.value
    subscription.trial_used = True
    subscription.trial_ends_at = start + timedelta(days=payload.days)
    subscription.cancelled_at = None
    session.add(subscription)

    add_audit_log(
        session,
        action="billing.trial_extended",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog_id,
        actor=actor,
        details={
            "plan": plan.value,
            "days": payload.days,
            "from": previous_end.isoformat() if previous_end else None,
            "to": subscription.trial_ends_at.isoformat(),
        },
        request=request,
    )
    _notify_owners(
        session,
        blog_id,
        type="billing_trial_extended",
        title=f"Your {plan.value.title()} trial was extended",
        body=f"It now runs until {subscription.trial_ends_at.strftime('%d %b %Y')}.",
    )
    session.commit()
    return get_subscription_detail(session, blog_id)


def grant_plan(
    session: Session,
    blog_id: int,
    payload: GrantPlanRequest,
    actor: User,
    request: Optional[Request] = None,
) -> AdminSubscriptionDetail:
    _load(session, blog_id)
    subscription = _get_or_create_subscription(session, blog_id)
    _refuse_if_paying(subscription)

    until = as_utc(payload.until) if payload.plan != SubscriptionPlan.FREE else None
    if until is not None and until <= utc_now():
        raise BadRequestError(ErrorCode.INVALID_INPUT, "Choose an end date in the future, or leave it empty.")

    previous = subscription.plan
    subscription.plan = payload.plan
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.billing_interval = None
    subscription.current_period_ends_at = until
    subscription.cancelled_at = None
    session.add(subscription)

    add_audit_log(
        session,
        action="billing.plan_granted",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog_id,
        actor=actor,
        details={
            "from": previous.value,
            "to": payload.plan.value,
            "until": until.isoformat() if until else None,
        },
        request=request,
    )
    if payload.plan != SubscriptionPlan.FREE:
        _notify_owners(
            session,
            blog_id,
            type="billing_plan_granted",
            title=f"You're on the {payload.plan.value.title()} plan",
            body=(
                f"Inko gave this workspace the {payload.plan.value.title()} plan"
                + (f" until {until.strftime('%d %b %Y')}." if until else ".")
            ),
        )
    session.commit()
    return get_subscription_detail(session, blog_id)


def end_trial(
    session: Session,
    blog_id: int,
    payload: EndTrialRequest,
    actor: User,
    request: Optional[Request] = None,
) -> AdminSubscriptionDetail:
    """
    Stop a running trial now (abuse, a trial given by mistake, testing). The
    workspace moves to Free; nothing is deleted, and the trial stays used.
    """
    _load(session, blog_id)
    subscription = _get_or_create_subscription(session, blog_id)
    _refuse_if_paying(subscription)
    if subscription.status != SubscriptionStatus.TRIALING or get_effective_plan(subscription) == SubscriptionPlan.FREE:
        raise BadRequestError(ErrorCode.OPERATION_NOT_ALLOWED, "This workspace isn't on a running trial.")

    plan = subscription.plan
    subscription.plan = SubscriptionPlan.FREE
    subscription.status = SubscriptionStatus.ACTIVE.value
    subscription.trial_used = True
    subscription.trial_ends_at = utc_now()
    session.add(subscription)

    add_audit_log(
        session,
        action="billing.trial_ended",
        resource_type="subscription",
        resource_id=subscription.id,
        blog_id=blog_id,
        actor=actor,
        details={"plan": plan.value, "reason": payload.reason.strip()},
        request=request,
    )
    _notify_owners(
        session,
        blog_id,
        type="billing_trial_ended",
        title=f"Your {plan.value.title()} trial has ended",
        body="This workspace is now on the Free plan. Nothing has been deleted.",
    )
    session.commit()
    return get_subscription_detail(session, blog_id)
