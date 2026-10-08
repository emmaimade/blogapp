"""
Plan changes on a paying workspace: prorated upgrades now, downgrades at the
end of the paid period (and undoing them), resuming a cancelled plan, and the
cases that must go through checkout instead. Paystack is never called.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, select

from app.core.config import settings
from app.core.datetimes import as_utc
from app.core.db import engine
from app.core.plans import get_effective_plan
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import BlogSubscription, PaymentTransaction, SubscriptionPlan
from app.modules.billing import paystack
from app.modules.billing.plan_change import add_period

PRICES = {"PLN_pro_m": 500_000, "PLN_pro_y": 5_000_000, "PLN_team_m": 1_500_000, "PLN_team_y": 15_000_000}
DAY = timedelta(days=1)


@pytest.fixture(autouse=True)
def _paystack(monkeypatch):
    monkeypatch.setattr(settings, "PAYSTACK_SECRET_KEY", "sk_test_plan_change")
    for key, code in {
        "PAYSTACK_PLAN_PRO_MONTHLY": "PLN_pro_m",
        "PAYSTACK_PLAN_PRO_YEARLY": "PLN_pro_y",
        "PAYSTACK_PLAN_TEAM_MONTHLY": "PLN_team_m",
        "PAYSTACK_PLAN_TEAM_YEARLY": "PLN_team_y",
    }.items():
        monkeypatch.setattr(settings, key, code)

    calls = {"charges": [], "created": [], "disabled": [], "charge_status": "success"}
    monkeypatch.setattr(paystack, "fetch_plan", lambda code: {"amount": PRICES[code], "currency": "NGN"})

    def charge(**kwargs):
        calls["charges"].append(kwargs)
        return {"status": calls["charge_status"], "reference": kwargs["reference"]}

    def create(**kwargs):
        # Unique like Paystack's: tests share one database.
        code = f"SUB_new_{uuid.uuid4().hex[:10]}"
        calls["created"].append({**kwargs, "code": code})
        return {"subscription_code": code, "email_token": f"tok_{code}"}

    monkeypatch.setattr(paystack, "charge_authorization", charge)
    monkeypatch.setattr(paystack, "create_subscription", create)
    monkeypatch.setattr(paystack, "disable_subscription", lambda code, token: calls["disabled"].append(code))
    monkeypatch.setattr(
        paystack,
        "verify_transaction",
        lambda ref: {
            "status": "success",
            "authorization": {"authorization_code": "AUTH_from_history", "reusable": True},
            "customer": {"email": "owner@example.com", "customer_code": "CUS_hist"},
        },
    )
    return calls


def _register(client) -> tuple[dict, int]:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": f"user-{uuid.uuid4().hex[:12]}@example.com",
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, resp.json()["user"]["blog_memberships"][0]["blog_id"]


def _paying(
    client,
    plan: SubscriptionPlan = SubscriptionPlan.PRO,
    interval: str = "monthly",
    paid_kobo: int = 500_000,
    used: timedelta = 10 * DAY,
    left: timedelta = 20 * DAY,
    status: str = "active",
    with_card: bool = True,
) -> tuple[dict, int]:
    """A workspace paying through Paystack, `used` into a period with `left` to go."""
    headers, blog_id = _register(client)
    now = datetime.now(timezone.utc)
    reference = f"ref-{uuid.uuid4().hex[:12]}"
    with Session(engine) as session:
        session.add(
            PaymentTransaction(
                blog_id=blog_id, reference=reference, amount_kobo=paid_kobo, plan=plan.value,
                billing_interval=interval, status="success", paid_at=now - used,
            )
        )
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.billing_interval = interval
        subscription.status = status
        subscription.paystack_subscription_code = f"SUB_old_{blog_id}"
        subscription.paystack_email_token = f"tok_old_{blog_id}"
        subscription.paystack_customer_code = "CUS_1"
        subscription.paystack_authorization_code = "AUTH_1" if with_card else None
        subscription.paystack_customer_email = "owner@example.com" if with_card else None
        subscription.last_payment_reference = reference
        subscription.current_period_started_at = now - used
        subscription.current_period_ends_at = now + left
        session.add(subscription)
        session.commit()
    return headers, blog_id


def _subscription(blog_id: int) -> BlogSubscription:
    with Session(engine) as session:
        return session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).one()


def _when(value: str) -> datetime:
    return as_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))


def _close(a: datetime, b: datetime, seconds: float = 120) -> bool:
    return abs((as_utc(a) - as_utc(b)).total_seconds()) < seconds


# ── Upgrades ─────────────────────────────────────────────────────────────────

def test_upgrade_preview_prorates(client):
    headers, blog_id = _paying(client)  # Pro monthly, 2/3 of the period left

    resp = client.post(f"/blogs/{blog_id}/billing/change/preview", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    quote = resp.json()
    assert quote["kind"] == "upgrade"
    assert abs(quote["credit_kobo"] - 333_333) <= 10
    assert abs(quote["charge_now_kobo"] - (1_500_000 - 333_333)) <= 10
    assert _close(_when(quote["next_charge_at"]), add_period(datetime.now(timezone.utc), "monthly"))
    # A preview changes nothing.
    assert _subscription(blog_id).plan == SubscriptionPlan.PRO


def test_upgrade_charges_difference_and_replaces_subscription(client, _paystack):
    headers, blog_id = _paying(client)

    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["effective_plan"] == "team"
    [charge] = _paystack["charges"]
    assert charge["authorization_code"] == "AUTH_1"
    assert abs(charge["amount_kobo"] - 1_166_667) <= 10
    [created] = _paystack["created"]
    assert created["plan_code"] == "PLN_team_m"
    assert _close(created["start_date"], add_period(datetime.now(timezone.utc), "monthly"))
    assert _paystack["disabled"] == [f"SUB_old_{blog_id}"]

    subscription = _subscription(blog_id)
    assert subscription.plan == SubscriptionPlan.TEAM
    assert subscription.paystack_subscription_code == _paystack["created"][0]["code"]
    assert subscription.pending_plan is None
    with Session(engine) as session:
        paid = session.exec(select(PaymentTransaction).where(PaymentTransaction.reference == subscription.last_payment_reference)).one()
        assert paid.plan == "team" and paid.status == "success"


def test_upgrade_covered_by_credit_charges_nothing_and_pushes_renewal(client, _paystack):
    # Pro yearly with ~300 days left is worth ~₦41,000 — more than a month of Team.
    headers, blog_id = _paying(client, interval="yearly", paid_kobo=5_000_000, used=65 * DAY, left=300 * DAY)

    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert _paystack["charges"] == []
    start = as_utc(_paystack["created"][0]["start_date"])
    # ₦41k of credit at ₦15k a month covers about 2.7 months of Team.
    assert datetime.now(timezone.utc) + 75 * DAY < start < datetime.now(timezone.utc) + 90 * DAY
    assert resp.json()["effective_plan"] == "team"


def test_monthly_to_yearly_is_an_upgrade(client, _paystack):
    headers, blog_id = _paying(client)
    resp = client.post(f"/blogs/{blog_id}/billing/change/preview", json={"plan": "pro", "interval": "yearly"}, headers=headers)
    assert resp.json()["kind"] == "upgrade"
    assert abs(resp.json()["charge_now_kobo"] - (5_000_000 - 333_333)) <= 10


def test_failed_card_charge_changes_nothing(client, _paystack):
    headers, blog_id = _paying(client)
    _paystack["charge_status"] = "failed"

    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 400
    assert resp.json()["code"] == "PAYMENT_NOT_SUCCESSFUL"
    assert _paystack["created"] == [] and _paystack["disabled"] == []
    assert _subscription(blog_id).plan == SubscriptionPlan.PRO


# ── Downgrades ───────────────────────────────────────────────────────────────

def test_downgrade_waits_for_period_end(client, _paystack):
    headers, blog_id = _paying(client, plan=SubscriptionPlan.TEAM, paid_kobo=1_500_000)
    period_end = as_utc(_subscription(blog_id).current_period_ends_at)

    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "pro", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["effective_plan"] == "team"
    assert body["pending_plan"] == "pro"
    assert _close(_when(body["pending_change_at"]), period_end, 2)
    assert _paystack["charges"] == []
    assert _close(_paystack["created"][0]["start_date"], period_end, 2)
    assert _paystack["disabled"] == [f"SUB_old_{blog_id}"]

    subscription = _subscription(blog_id)
    assert subscription.plan == SubscriptionPlan.TEAM
    # Once the date passes the workspace follows Pro, even before the renewal webhook.
    assert get_effective_plan(subscription, now=period_end + timedelta(hours=1)) == SubscriptionPlan.PRO


def test_yearly_to_monthly_is_a_downgrade(client):
    headers, blog_id = _paying(client, interval="yearly", paid_kobo=5_000_000, left=200 * DAY)
    resp = client.post(f"/blogs/{blog_id}/billing/change/preview", json={"plan": "pro", "interval": "monthly"}, headers=headers)
    assert resp.json()["kind"] == "downgrade"
    assert resp.json()["charge_now_kobo"] == 0


def test_undo_scheduled_downgrade(client, _paystack):
    headers, blog_id = _paying(client, plan=SubscriptionPlan.TEAM, paid_kobo=1_500_000)
    client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "pro", "interval": "monthly"}, headers=headers)

    resp = client.post(f"/blogs/{blog_id}/billing/change/undo", headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["pending_plan"] is None
    assert _paystack["created"][-1]["plan_code"] == "PLN_team_m"
    assert _paystack["disabled"][-1] == _paystack["created"][0]["code"]  # the scheduled Pro subscription
    assert _subscription(blog_id).paystack_subscription_code == _paystack["created"][1]["code"]


def test_undo_without_pending_change_is_rejected(client):
    headers, blog_id = _paying(client)
    resp = client.post(f"/blogs/{blog_id}/billing/change/undo", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == "NO_PENDING_CHANGE"


def test_renewal_switches_to_the_scheduled_plan(client, _paystack):
    import hashlib, hmac, json

    headers, blog_id = _paying(client, plan=SubscriptionPlan.TEAM, paid_kobo=1_500_000)
    client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "pro", "interval": "monthly"}, headers=headers)
    pending_at = as_utc(_subscription(blog_id).pending_change_at)

    body = json.dumps({
        "event": "invoice.update",
        "data": {
            "invoice_code": f"INV_{uuid.uuid4().hex[:6]}",
            "status": "success",
            "paid": True,
            "paid_at": pending_at.isoformat(),
            "subscription": {"subscription_code": _paystack["created"][0]["code"], "next_payment_date": (pending_at + 30 * DAY).isoformat()},
            "transaction": {"reference": f"renew-{uuid.uuid4().hex[:8]}", "amount": 500_000},
        },
    }).encode()
    signature = hmac.new(b"sk_test_plan_change", body, hashlib.sha512).hexdigest()
    resp = client.post("/billing/webhook", content=body, headers={"x-paystack-signature": signature, "content-type": "application/json"})

    assert resp.status_code == 200, resp.text
    subscription = _subscription(blog_id)
    assert subscription.plan == SubscriptionPlan.PRO
    assert subscription.pending_plan is None


def test_cancel_drops_a_scheduled_downgrade(client, _paystack):
    headers, blog_id = _paying(client, plan=SubscriptionPlan.TEAM, paid_kobo=1_500_000)
    client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "pro", "interval": "monthly"}, headers=headers)

    resp = client.post(f"/blogs/{blog_id}/billing/cancel", headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "canceled"
    assert resp.json()["pending_plan"] is None
    assert _paystack["disabled"][-1] == _paystack["created"][0]["code"]


# ── Resume, refusals, card ───────────────────────────────────────────────────

def test_same_plan_while_active_is_rejected(client):
    headers, blog_id = _paying(client)
    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "pro", "interval": "monthly"}, headers=headers)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ALREADY_SUBSCRIBED"


def test_resume_cancelled_plan_restarts_renewal_without_charge(client, _paystack):
    headers, blog_id = _paying(client, status="canceled")
    period_end = as_utc(_subscription(blog_id).current_period_ends_at)

    preview = client.post(f"/blogs/{blog_id}/billing/change/preview", json={"plan": "pro", "interval": "monthly"}, headers=headers)
    assert preview.json()["kind"] == "resume"
    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "pro", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"
    assert _paystack["charges"] == []
    assert _close(_paystack["created"][0]["start_date"], period_end, 2)
    # The cancelled subscription is already stopped.
    assert _paystack["disabled"] == []


def test_trial_must_use_checkout(client):
    headers, blog_id = _register(client)
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first() or BlogSubscription(blog_id=blog_id)
        subscription.plan = SubscriptionPlan.PRO
        subscription.status = "trialing"
        subscription.trial_ends_at = datetime.now(timezone.utc) + 5 * DAY
        session.add(subscription)
        session.commit()

    resp = client.post(f"/blogs/{blog_id}/billing/change/preview", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 400
    assert resp.json()["code"] == "PAYMENT_METHOD_REQUIRED"
    assert client.get(f"/blogs/{blog_id}/billing", headers=headers).json()["can_change_plan"] is False


def test_card_is_fetched_from_last_payment_when_not_saved(client, _paystack):
    headers, blog_id = _paying(client, with_card=False)

    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert _paystack["charges"][0]["authorization_code"] == "AUTH_from_history"
    assert _subscription(blog_id).paystack_authorization_code == "AUTH_from_history"


def test_overview_offers_in_place_change_to_paying_workspace(client):
    headers, blog_id = _paying(client)
    assert client.get(f"/blogs/{blog_id}/billing", headers=headers).json()["can_change_plan"] is True


def test_add_period_clamps_month_end():
    assert add_period(datetime(2026, 1, 31, tzinfo=timezone.utc), "monthly") == datetime(2026, 2, 28, tzinfo=timezone.utc)
    assert add_period(datetime(2026, 3, 15, tzinfo=timezone.utc), "yearly") == datetime(2027, 3, 15, tzinfo=timezone.utc)
