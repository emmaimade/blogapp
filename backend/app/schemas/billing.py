from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.blog import BillingInterval, SubscriptionPlan
from app.schemas.datetime_mixin import UTCDatetimeMixin


class CheckoutRequest(BaseModel):
    plan: SubscriptionPlan
    interval: BillingInterval


class CheckoutResponse(BaseModel):
    authorization_url: str
    reference: str


class ManageLinkResponse(BaseModel):
    link: str


class ChangePreview(UTCDatetimeMixin, BaseModel):
    """What a plan change will do, shown to the owner before they confirm."""
    # "upgrade" (now, prorated), "downgrade" (at period end), "resume", or
    # "trial" (switching before the first charge: nothing to prorate)
    kind: str
    plan: SubscriptionPlan
    interval: BillingInterval
    charge_now_kobo: int
    # Unused value of the current plan, put towards an upgrade.
    credit_kobo: int
    # When the new plan's features apply.
    effective_at: datetime
    # The first charge on the new plan's subscription, and its amount.
    next_charge_at: datetime
    next_charge_kobo: int


class PaymentTransactionRead(UTCDatetimeMixin, BaseModel):
    reference: str
    amount_kobo: int
    currency: str
    plan: str
    billing_interval: Optional[str] = None
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime


class BillingOverview(UTCDatetimeMixin, BaseModel):
    blog_id: int
    plan: SubscriptionPlan
    # What features actually follow right now — differs from `plan` once a
    # trial, paid period or grace period has run out.
    effective_plan: SubscriptionPlan
    status: str
    billing_interval: Optional[str] = None
    trial_used: bool
    trial_ends_at: Optional[datetime] = None
    current_period_ends_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    has_paystack_subscription: bool
    # A downgrade waiting for the end of the paid period.
    pending_plan: Optional[SubscriptionPlan] = None
    pending_interval: Optional[str] = None
    pending_change_at: Optional[datetime] = None
    # True when a plan change can be made on the saved card (prorated
    # upgrade, scheduled downgrade, resume) instead of a fresh checkout.
    can_change_plan: bool = False
    # A card was added during a trial that hasn't ended: nothing has been
    # charged yet and the first payment falls on trial_ends_at.
    trial_with_card: bool = False
    transactions: List[PaymentTransactionRead]


# ── Superadmin ───────────────────────────────────────────────────────────────

class AdminSubscriptionRow(UTCDatetimeMixin, BaseModel):
    blog_id: int
    blog_name: str
    owner_email: Optional[str] = None
    plan: SubscriptionPlan
    effective_plan: SubscriptionPlan
    status: str
    billing_interval: Optional[str] = None
    trial_used: bool
    trial_ends_at: Optional[datetime] = None
    current_period_ends_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    has_paystack_subscription: bool
    # This workspace's share of monthly recurring revenue: its latest payment,
    # with a yearly payment spread over 12 months. 0 unless it renews.
    monthly_value_kobo: int
    last_payment_at: Optional[datetime] = None
    # Exactly one of: paying, trialing, past_due, canceled (paid period still
    # running), granted (paid plan given by a superadmin), free.
    category: str


class AdminSubscriptionSummary(BaseModel):
    mrr_kobo: int
    paying: int
    trialing: int
    past_due: int
    canceled: int
    granted: int
    free: int


class AdminSubscriptionList(BaseModel):
    summary: AdminSubscriptionSummary
    subscriptions: List[AdminSubscriptionRow]


class AdminSubscriptionDetail(AdminSubscriptionRow):
    transactions: List[PaymentTransactionRead]


class ExtendTrialRequest(BaseModel):
    days: int = Field(ge=1, le=90)
    # Needed only when the workspace is on Free; otherwise its current paid plan is kept.
    plan: Optional[SubscriptionPlan] = None


class GrantPlanRequest(BaseModel):
    plan: SubscriptionPlan
    # None grants it with no end date. Ignored when granting Free.
    until: Optional[datetime] = None


class EndTrialRequest(BaseModel):
    # Kept in the audit log; not shown to the workspace owner.
    reason: str = Field(min_length=3, max_length=500)
