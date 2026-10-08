"""
Paystack billing: checkout, the return-redirect verify, cancellation and the
webhook. Paystack itself is never called — the client functions in
app.modules.billing.paystack are patched per test.
"""

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import (
    BlogMember,
    BlogRole,
    BlogSubscription,
    Notification,
    PaymentEvent,
    PaymentTransaction,
    SubscriptionPlan,
)
from app.core.error_codes import ErrorCode
from app.core.exceptions import ExternalServiceError
from app.modules.billing import paystack

SECRET = "sk_test_billing_suite"
PLAN_CODES = {
    "PAYSTACK_PLAN_PRO_MONTHLY": "PLN_pro_m",
    "PAYSTACK_PLAN_PRO_YEARLY": "PLN_pro_y",
    "PAYSTACK_PLAN_TEAM_MONTHLY": "PLN_team_m",
    "PAYSTACK_PLAN_TEAM_YEARLY": "PLN_team_y",
}
PRO_MONTHLY_KOBO = 500_000


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


# Relative to now so the suite doesn't start failing once a fixed date passes.
NEXT_PAYMENT = (datetime.now(timezone.utc) + timedelta(days=30)).replace(microsecond=0)
RENEWED_UNTIL = NEXT_PAYMENT + timedelta(days=30)


@pytest.fixture(autouse=True)
def _paystack(monkeypatch):
    """Configure billing and record every call that would reach Paystack."""
    monkeypatch.setattr(settings, "PAYSTACK_SECRET_KEY", SECRET)
    for key, code in PLAN_CODES.items():
        monkeypatch.setattr(settings, key, code)

    calls: dict[str, list] = {"initialize": [], "disable": [], "verify": []}
    monkeypatch.setattr(paystack, "fetch_plan", lambda code: {"amount": PRO_MONTHLY_KOBO, "currency": "NGN"})

    def initialize(**kwargs):
        calls["initialize"].append(kwargs)
        return {"authorization_url": f"https://checkout.paystack.com/{kwargs['reference']}"}

    monkeypatch.setattr(paystack, "initialize_transaction", initialize)
    monkeypatch.setattr(paystack, "disable_subscription", lambda code, token: calls["disable"].append(code))
    monkeypatch.setattr(paystack, "get_manage_link", lambda code: f"https://paystack.com/manage/{code}")
    # The return page looks up the new subscription; by default Paystack
    # hasn't created it yet, so linking is left to the webhook.
    monkeypatch.setattr(paystack, "list_subscriptions", lambda customer_id: [])
    calls["created"] = []
    calls["refunds"] = []

    def create_subscription(**kwargs):
        code = f"SUB_card_{uuid.uuid4().hex[:8]}"
        calls["created"].append({**kwargs, "code": code})
        return {"subscription_code": code, "email_token": f"tok_{code}"}

    monkeypatch.setattr(paystack, "create_subscription", create_subscription)
    monkeypatch.setattr(paystack, "refund_transaction", lambda ref: calls["refunds"].append(ref) or {"status": "pending"})
    return calls


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client) -> tuple[dict, int, int]:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": _unique_email(),
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _checkout(client, headers, blog_id, plan="pro", interval="monthly"):
    return client.post(f"/blogs/{blog_id}/billing/checkout", json={"plan": plan, "interval": interval}, headers=headers)


def _send_webhook(client, event: str, data: dict, secret: str = SECRET):
    body = json.dumps({"event": event, "data": data}).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()
    return client.post(
        "/billing/webhook",
        content=body,
        headers={"x-paystack-signature": signature, "content-type": "application/json"},
    )


def _charge(reference: str, amount: int = PRO_MONTHLY_KOBO, customer: str = "CUS_1") -> dict:
    return {
        "reference": reference,
        "status": "success",
        "amount": amount,
        "currency": "NGN",
        "paid_at": _iso(datetime.now(timezone.utc)),
        "customer": {"customer_code": customer, "id": 4242},
    }


def _paystack_subscription(code: str, plan_code: str = "PLN_pro_m", created: datetime | None = None, status: str = "active") -> dict:
    """One item from Paystack's list-subscriptions response."""
    return {
        "subscription_code": code,
        "email_token": f"tok_{code}",
        "status": status,
        "plan": {"plan_code": plan_code},
        "createdAt": _iso(created or datetime.now(timezone.utc)),
        "next_payment_date": _iso(NEXT_PAYMENT),
    }


def _subscription(blog_id: int) -> BlogSubscription:
    with Session(engine) as session:
        return session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).one()


def _paid_pro_workspace(client, customer="CUS_1", sub_code="SUB_1"):
    """A workspace that has checked out Pro monthly and been fully set up by webhooks."""
    headers, blog_id, user_id = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    assert _send_webhook(client, "charge.success", _charge(reference, customer=customer)).status_code == 200
    resp = _send_webhook(
        client,
        "subscription.create",
        {
            "subscription_code": sub_code,
            "email_token": f"tok_{sub_code}",
            "next_payment_date": _iso(NEXT_PAYMENT),
            "plan": {"plan_code": "PLN_pro_m"},
            "customer": {"customer_code": customer},
        },
    )
    assert resp.status_code == 200, resp.text
    return headers, blog_id, user_id


# ── Checkout ─────────────────────────────────────────────────────────────────

def test_checkout_returns_paystack_url_and_records_pending_payment(client, _paystack):
    headers, blog_id, _ = _register(client)

    resp = _checkout(client, headers, blog_id)

    assert resp.status_code == 200, resp.text
    reference = resp.json()["reference"]
    assert resp.json()["authorization_url"].endswith(reference)
    sent = _paystack["initialize"][0]
    assert sent["plan_code"] == "PLN_pro_m"
    assert sent["metadata"]["blog_id"] == blog_id
    assert f"/admin/settings/billing/callback?blog={blog_id}" in sent["callback_url"]
    with Session(engine) as session:
        tx = session.exec(select(PaymentTransaction).where(PaymentTransaction.reference == reference)).one()
        assert tx.status == "pending"
        assert tx.amount_kobo == PRO_MONTHLY_KOBO


def test_checkout_for_free_plan_is_rejected(client):
    headers, blog_id, _ = _register(client)
    assert _checkout(client, headers, blog_id, plan="free").status_code == 400


def test_checkout_is_owner_only(client):
    _, blog_id, _ = _register(client)
    editor_headers, _, editor_id = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(user_id=editor_id, blog_id=blog_id, role=BlogRole.EDITOR))
        session.commit()

    resp = _checkout(client, editor_headers, blog_id)

    assert resp.status_code == 403
    assert resp.json()["code"] == "INSUFFICIENT_PERMISSIONS"


def test_checkout_without_paystack_keys_is_unavailable(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    monkeypatch.setattr(settings, "PAYSTACK_PLAN_PRO_MONTHLY", None)

    resp = _checkout(client, headers, blog_id)

    assert resp.status_code == 503
    assert resp.json()["code"] == "BILLING_NOT_CONFIGURED"


def test_checkout_for_current_plan_conflicts(client):
    headers, blog_id, _ = _paid_pro_workspace(client, customer="CUS_dupe", sub_code="SUB_dupe")
    resp = _checkout(client, headers, blog_id)
    assert resp.status_code == 409
    assert resp.json()["code"] == "ALREADY_SUBSCRIBED"


# ── Verify (return redirect) ─────────────────────────────────────────────────

def test_verify_activates_plan(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _charge(ref))

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["plan"] == "pro"
    assert body["effective_plan"] == "pro"
    assert body["status"] == "active"
    assert body["billing_interval"] == "monthly"
    assert [t["reference"] for t in body["transactions"]] == [reference]


def test_verify_failed_payment_leaves_plan_unchanged(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: {**_charge(ref), "status": "abandoned"})

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 400
    assert resp.json()["code"] == "PAYMENT_NOT_SUCCESSFUL"
    assert _subscription(blog_id).plan == SubscriptionPlan.FREE


def test_verify_rejects_another_workspaces_reference(client):
    headers, blog_id, _ = _register(client)
    other_headers, other_blog_id, _ = _register(client)
    reference = _checkout(client, other_headers, other_blog_id).json()["reference"]

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 404
    assert resp.json()["code"] == "PAYMENT_NOT_FOUND"


# ── Webhook ──────────────────────────────────────────────────────────────────

def test_webhook_rejects_bad_signature(client):
    resp = _send_webhook(client, "charge.success", _charge("nope"), secret="sk_test_wrong")
    assert resp.status_code == 401
    assert resp.json()["code"] == "INVALID_WEBHOOK_SIGNATURE"


def test_webhook_rejects_missing_signature(client):
    resp = client.post("/billing/webhook", json={"event": "charge.success", "data": {}})
    assert resp.status_code == 401


def test_charge_success_webhook_is_applied_once(client):
    headers, blog_id, user_id = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]

    assert _send_webhook(client, "charge.success", _charge(reference)).status_code == 200
    assert _send_webhook(client, "charge.success", _charge(reference)).status_code == 200

    subscription = _subscription(blog_id)
    assert subscription.plan == SubscriptionPlan.PRO
    assert subscription.status == "active"
    assert subscription.paystack_customer_code == "CUS_1"
    with Session(engine) as session:
        events = session.exec(select(PaymentEvent).where(PaymentEvent.event_key == f"charge.success:{reference}")).all()
        assert len(events) == 1
        notes = session.exec(
            select(Notification).where(Notification.user_id == user_id, Notification.type == "billing_payment_succeeded")
        ).all()
        assert len(notes) == 1


def test_charge_with_wrong_amount_does_not_activate(client):
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]

    _send_webhook(client, "charge.success", _charge(reference, amount=100))

    assert _subscription(blog_id).plan == SubscriptionPlan.FREE


def test_subscription_create_links_paystack_subscription(client):
    _, blog_id, _ = _paid_pro_workspace(client, customer="CUS_link", sub_code="SUB_link")

    subscription = _subscription(blog_id)
    assert subscription.paystack_subscription_code == "SUB_link"
    assert subscription.paystack_email_token == "tok_SUB_link"
    assert subscription.current_period_ends_at.replace(tzinfo=timezone.utc) == NEXT_PAYMENT


def test_subscription_create_before_charge_asks_paystack_to_retry(client):
    resp = _send_webhook(
        client,
        "subscription.create",
        {
            "subscription_code": "SUB_early",
            "plan": {"plan_code": "PLN_pro_m"},
            "customer": {"customer_code": "CUS_unknown"},
        },
    )

    assert resp.status_code == 503
    with Session(engine) as session:
        assert session.exec(select(PaymentEvent).where(PaymentEvent.event_key == "subscription.create:SUB_early")).first() is None


def test_switching_plan_disables_the_old_subscription(client, _paystack):
    headers, blog_id, _ = _paid_pro_workspace(client, customer="CUS_switch", sub_code="SUB_old")
    reference = _checkout(client, headers, blog_id, plan="pro", interval="yearly").json()["reference"]
    _send_webhook(client, "charge.success", _charge(reference, customer="CUS_switch"))

    _send_webhook(
        client,
        "subscription.create",
        {
            "subscription_code": "SUB_new",
            "email_token": "tok_new",
            "plan": {"plan_code": "PLN_pro_y"},
            "customer": {"customer_code": "CUS_switch"},
        },
    )

    assert _paystack["disable"] == ["SUB_old"]
    subscription = _subscription(blog_id)
    assert subscription.paystack_subscription_code == "SUB_new"
    assert subscription.billing_interval == "yearly"
    # The old subscription's disable event must not cancel the new plan.
    _send_webhook(client, "subscription.disable", {"subscription_code": "SUB_old", "status": "complete"})
    assert _subscription(blog_id).status == "active"


def test_invoice_paid_renews_and_records_payment(client):
    headers, blog_id, _ = _paid_pro_workspace(client, customer="CUS_renew", sub_code="SUB_renew")

    _send_webhook(
        client,
        "invoice.update",
        {
            "invoice_code": "INV_1",
            "status": "success",
            "paid": True,
            "paid_at": _iso(NEXT_PAYMENT),
            "subscription": {"subscription_code": "SUB_renew", "next_payment_date": _iso(RENEWED_UNTIL)},
            "transaction": {"reference": "renewal-ref-1", "amount": PRO_MONTHLY_KOBO, "currency": "NGN"},
        },
    )

    subscription = _subscription(blog_id)
    assert subscription.current_period_ends_at.replace(tzinfo=timezone.utc) == RENEWED_UNTIL
    overview = client.get(f"/blogs/{blog_id}/billing", headers=headers).json()
    assert "renewal-ref-1" in [t["reference"] for t in overview["transactions"]]


def test_failed_renewal_marks_past_due_and_notifies_owner(client):
    _, blog_id, user_id = _paid_pro_workspace(client, customer="CUS_fail", sub_code="SUB_fail")

    _send_webhook(
        client,
        "invoice.payment_failed",
        {"invoice_code": "INV_fail", "status": "failed", "paid": False, "subscription": {"subscription_code": "SUB_fail"}},
    )

    assert _subscription(blog_id).status == "past_due"
    with Session(engine) as session:
        assert session.exec(
            select(Notification).where(Notification.user_id == user_id, Notification.type == "billing_payment_failed")
        ).first()


def test_not_renew_webhook_cancels(client):
    _, blog_id, _ = _paid_pro_workspace(client, customer="CUS_nr", sub_code="SUB_nr")

    _send_webhook(client, "subscription.not_renew", {"subscription_code": "SUB_nr", "status": "non-renewing"})

    subscription = _subscription(blog_id)
    assert subscription.status == "canceled"
    assert subscription.cancelled_at is not None


def test_unknown_event_is_acknowledged(client):
    assert _send_webhook(client, "transfer.success", {"id": 12345}).status_code == 200


# ── Cancel & manage ──────────────────────────────────────────────────────────

def test_cancel_paid_subscription_keeps_access_until_period_end(client, _paystack):
    headers, blog_id, _ = _paid_pro_workspace(client, customer="CUS_cancel", sub_code="SUB_cancel")

    resp = client.post(f"/blogs/{blog_id}/billing/cancel", headers=headers)

    assert resp.status_code == 200, resp.text
    assert _paystack["disable"] == ["SUB_cancel"]
    assert resp.json()["status"] == "canceled"
    # Paid through NEXT_PAYMENT, so Pro features stay on until then.
    assert resp.json()["effective_plan"] == "pro"


def test_cancel_trial_drops_to_free(client):
    headers, blog_id, _ = _register(client)
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        if subscription is None:
            subscription = BlogSubscription(blog_id=blog_id)
        subscription.plan = SubscriptionPlan.TEAM
        subscription.status = "trialing"
        subscription.trial_used = True
        subscription.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=10)
        session.add(subscription)
        session.commit()

    resp = client.post(f"/blogs/{blog_id}/billing/cancel", headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["plan"] == "free"
    assert resp.json()["effective_plan"] == "free"
    assert resp.json()["trial_used"] is True


def test_cancel_without_subscription_is_rejected(client):
    headers, blog_id, _ = _register(client)
    resp = client.post(f"/blogs/{blog_id}/billing/cancel", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == "NO_ACTIVE_SUBSCRIPTION"


def test_manage_link(client):
    headers, blog_id, _ = _paid_pro_workspace(client, customer="CUS_manage", sub_code="SUB_manage")
    resp = client.get(f"/blogs/{blog_id}/billing/manage-link", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["link"].endswith("SUB_manage")


# ── Linking the subscription from the return page ────────────────────────────

def test_verify_links_new_subscription(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _charge(ref))
    monkeypatch.setattr(paystack, "list_subscriptions", lambda customer_id: [_paystack_subscription("SUB_return")])

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["has_paystack_subscription"] is True
    subscription = _subscription(blog_id)
    assert subscription.paystack_subscription_code == "SUB_return"
    assert subscription.paystack_email_token == "tok_SUB_return"
    # The webhook arriving afterwards finds it already linked.
    assert _send_webhook(
        client,
        "subscription.create",
        {"subscription_code": "SUB_return", "plan": {"plan_code": "PLN_pro_m"}, "customer": {"customer_code": "CUS_1"}},
    ).status_code == 200
    assert _subscription(blog_id).paystack_subscription_code == "SUB_return"


def test_verify_ignores_older_subscriptions(client, monkeypatch):
    """A subscription from before this payment (e.g. an orphaned earlier one) is not this checkout's."""
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _charge(ref))
    old = datetime.now(timezone.utc) - timedelta(hours=3)
    monkeypatch.setattr(
        paystack,
        "list_subscriptions",
        lambda customer_id: [
            _paystack_subscription("SUB_orphan", created=old),
            _paystack_subscription("SUB_other_plan", plan_code="PLN_team_m"),
            _paystack_subscription("SUB_cancelled", status="cancelled"),
        ],
    )

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert _subscription(blog_id).paystack_subscription_code is None


def test_verify_after_webhook_links_and_replaces_old_subscription(client, monkeypatch, _paystack):
    headers, blog_id, _ = _paid_pro_workspace(client, customer="CUS_rp", sub_code="SUB_rp_old")
    reference = _checkout(client, headers, blog_id, plan="team").json()["reference"]
    # The webhook applies the charge first; then the owner lands on the return page.
    _send_webhook(client, "charge.success", _charge(reference, customer="CUS_rp"))
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _charge(ref, customer="CUS_rp"))
    monkeypatch.setattr(
        paystack, "list_subscriptions", lambda customer_id: [_paystack_subscription("SUB_rp_new", plan_code="PLN_team_m")]
    )

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert _subscription(blog_id).paystack_subscription_code == "SUB_rp_new"
    assert _paystack["disable"] == ["SUB_rp_old"]


def test_verify_still_succeeds_when_paystack_lookup_fails(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _charge(ref))

    def unavailable(customer_id):
        raise ExternalServiceError(ErrorCode.PAYMENT_PROVIDER_ERROR)

    monkeypatch.setattr(paystack, "list_subscriptions", unavailable)

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["plan"] == "pro"
    assert resp.json()["has_paystack_subscription"] is False


def test_checkout_payment_saves_reusable_card(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    charge = {
        **_charge(reference),
        "authorization": {"authorization_code": "AUTH_saved", "reusable": True},
        "customer": {"customer_code": "CUS_1", "id": 4242, "email": "payer@example.com"},
    }
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: charge)

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    subscription = _subscription(blog_id)
    assert subscription.paystack_authorization_code == "AUTH_saved"
    assert subscription.paystack_customer_email == "payer@example.com"
    assert subscription.current_period_started_at is not None



# ── Adding a card during a trial ─────────────────────────────────────────────

def _start_trial(blog_id: int, plan=SubscriptionPlan.PRO, days: int = 9) -> datetime:
    ends = datetime.now(timezone.utc) + timedelta(days=days)
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = plan
        subscription.status = "trialing"
        subscription.trial_used = True
        subscription.trial_ends_at = ends
        session.add(subscription)
        session.commit()
    return ends


def _card_charge(reference: str) -> dict:
    return {
        **_charge(reference, amount=5_000),
        "authorization": {"authorization_code": "AUTH_trial", "reusable": True},
        "customer": {"customer_code": "CUS_trial", "id": 77, "email": "owner@example.com"},
    }


def test_checkout_during_trial_is_a_small_card_check(client, _paystack):
    headers, blog_id, _ = _register(client)
    _start_trial(blog_id)

    resp = _checkout(client, headers, blog_id)

    assert resp.status_code == 200, resp.text
    sent = _paystack["initialize"][-1]
    assert sent["amount_kobo"] == 5_000
    assert sent["plan_code"] is None
    assert resp.json()["reference"].startswith("inko-card-")


def test_card_check_schedules_first_charge_for_trial_end(client, monkeypatch, _paystack):
    headers, blog_id, _ = _register(client)
    trial_end = _start_trial(blog_id)
    reference = _checkout(client, headers, blog_id, plan="pro", interval="yearly").json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _card_charge(ref))

    resp = client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["effective_plan"] == "pro"
    assert body["billing_interval"] == "yearly"
    assert body["has_paystack_subscription"] is True
    [created] = _paystack["created"]
    assert created["plan_code"] == "PLN_pro_y"
    assert created["authorization_code"] == "AUTH_trial"
    assert abs((created["start_date"] - trial_end).total_seconds()) < 2
    assert _paystack["refunds"] == [reference]
    assert [t["status"] for t in body["transactions"]] == ["refunded"]
    assert body["trial_with_card"] is True
    subscription = _subscription(blog_id)
    assert abs((subscription.current_period_ends_at.replace(tzinfo=timezone.utc) - trial_end).total_seconds()) < 2


def test_switching_plan_during_carded_trial_costs_nothing(client, monkeypatch, _paystack):
    headers, blog_id, _ = _register(client)
    trial_end = _start_trial(blog_id)
    reference = _checkout(client, headers, blog_id).json()["reference"]
    monkeypatch.setattr(paystack, "verify_transaction", lambda ref: _card_charge(ref))
    client.get(f"/blogs/{blog_id}/billing/verify", params={"reference": reference}, headers=headers)
    monkeypatch.setattr(paystack, "fetch_plan", lambda code: {"amount": 1_500_000 if "team" in code else PRO_MONTHLY_KOBO})
    charges = []
    monkeypatch.setattr(paystack, "charge_authorization", lambda **kw: charges.append(kw) or {"status": "success"})

    preview = client.post(f"/blogs/{blog_id}/billing/change/preview", json={"plan": "team", "interval": "monthly"}, headers=headers)
    assert preview.status_code == 200, preview.text
    assert preview.json()["kind"] == "trial"
    assert preview.json()["charge_now_kobo"] == 0

    resp = client.post(f"/blogs/{blog_id}/billing/change", json={"plan": "team", "interval": "monthly"}, headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["effective_plan"] == "team"
    assert charges == []
    assert abs((_paystack["created"][-1]["start_date"] - trial_end).total_seconds()) < 2


def test_checkout_after_trial_ended_charges_full_price(client, _paystack):
    headers, blog_id, _ = _register(client)
    _start_trial(blog_id, days=-1)

    _checkout(client, headers, blog_id)

    sent = _paystack["initialize"][-1]
    assert sent["amount_kobo"] == PRO_MONTHLY_KOBO
    assert sent["plan_code"] == "PLN_pro_m"



def test_paying_during_an_old_trial_is_not_trial_with_card(client, monkeypatch):
    headers, blog_id, _ = _register(client)
    _start_trial(blog_id)
    # Paid in full before card checks existed: last payment is a real charge.
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).one()
        subscription.status = "active"
        subscription.last_payment_reference = "inko-12-realcharge"
        session.add(subscription)
        session.commit()

    assert client.get(f"/blogs/{blog_id}/billing", headers=headers).json()["trial_with_card"] is False
