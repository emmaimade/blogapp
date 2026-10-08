"""
Superadmin subscriptions: the platform-wide list and summary, one
workspace's detail, extending a trial and granting a plan.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.datetimes import as_utc
from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import AuditLog, BlogSubscription, Notification, PaymentTransaction, SubscriptionPlan, User


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client) -> tuple[dict, int, int, str]:
    email = _unique_email()
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": email,
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"], email


def _superadmin(client) -> dict:
    headers, _, user_id, _ = _register(client)
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.is_super_admin = True
        session.add(user)
        session.commit()
    return headers


def _set_subscription(blog_id: int, **fields) -> None:
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        for key, value in fields.items():
            setattr(subscription, key, value)
        session.add(subscription)
        session.commit()


def _add_payment(blog_id: int, amount_kobo: int, interval: str, plan: str = "pro") -> None:
    with Session(engine) as session:
        session.add(
            PaymentTransaction(
                blog_id=blog_id,
                reference=f"ref-{uuid.uuid4().hex[:12]}",
                amount_kobo=amount_kobo,
                plan=plan,
                billing_interval=interval,
                status="success",
                paid_at=datetime.now(timezone.utc),
            )
        )
        session.commit()


def _future(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def _row(body: dict, blog_id: int) -> dict:
    return next(row for row in body["subscriptions"] if row["blog_id"] == blog_id)


# ── Access ───────────────────────────────────────────────────────────────────

def test_subscription_admin_is_superadmin_only(client):
    headers, blog_id, _, _ = _register(client)

    assert client.get("/superadmin/subscriptions", headers=headers).status_code == 403
    assert client.get(f"/superadmin/subscriptions/{blog_id}", headers=headers).status_code == 403
    assert client.post(f"/superadmin/subscriptions/{blog_id}/grant", json={"plan": "team"}, headers=headers).status_code == 403


# ── List & summary ───────────────────────────────────────────────────────────

def test_list_categorises_workspaces_and_counts_mrr(client):
    admin = _superadmin(client)
    before = client.get("/superadmin/subscriptions", headers=admin).json()["summary"]

    _, paying_monthly, _, owner_email = _register(client)
    _set_subscription(paying_monthly, plan=SubscriptionPlan.PRO, status="active", billing_interval="monthly",
                      paystack_subscription_code=f"SUB_{uuid.uuid4().hex[:8]}", current_period_ends_at=_future(20))
    _add_payment(paying_monthly, 500_000, "monthly")

    _, paying_yearly, _, _ = _register(client)
    _set_subscription(paying_yearly, plan=SubscriptionPlan.TEAM, status="active", billing_interval="yearly",
                      paystack_subscription_code=f"SUB_{uuid.uuid4().hex[:8]}", current_period_ends_at=_future(300))
    _add_payment(paying_yearly, 15_000_000, "yearly", plan="team")

    _, trialing, _, _ = _register(client)
    _set_subscription(trialing, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=_future(5))

    _, expired_trial, _, _ = _register(client)
    _set_subscription(expired_trial, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=_future(-1))

    _, cancelled, _, _ = _register(client)
    _set_subscription(cancelled, plan=SubscriptionPlan.PRO, status="canceled", billing_interval="monthly",
                      paystack_subscription_code=f"SUB_{uuid.uuid4().hex[:8]}", current_period_ends_at=_future(10))
    _add_payment(cancelled, 500_000, "monthly")

    resp = client.get("/superadmin/subscriptions", headers=admin)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert _row(body, paying_monthly)["category"] == "paying"
    assert _row(body, paying_monthly)["owner_email"] == owner_email
    assert _row(body, paying_monthly)["monthly_value_kobo"] == 500_000
    assert _row(body, paying_yearly)["monthly_value_kobo"] == 1_250_000
    assert _row(body, trialing)["category"] == "trialing"
    assert _row(body, expired_trial)["category"] == "free"
    assert _row(body, expired_trial)["effective_plan"] == "free"
    # Cancelled plans still have paid time left but no longer count as recurring revenue.
    assert _row(body, cancelled)["category"] == "canceled"
    assert _row(body, cancelled)["monthly_value_kobo"] == 0

    summary = body["summary"]
    assert summary["mrr_kobo"] - before["mrr_kobo"] == 1_750_000
    assert summary["paying"] - before["paying"] == 2
    assert summary["trialing"] - before["trialing"] == 1
    assert summary["canceled"] - before["canceled"] == 1


def test_detail_includes_payment_history(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    _add_payment(blog_id, 500_000, "monthly")

    resp = client.get(f"/superadmin/subscriptions/{blog_id}", headers=admin)

    assert resp.status_code == 200, resp.text
    assert [t["amount_kobo"] for t in resp.json()["transactions"]] == [500_000]


def test_detail_for_unknown_workspace_is_404(client):
    admin = _superadmin(client)
    resp = client.get("/superadmin/subscriptions/999999", headers=admin)
    assert resp.status_code == 404
    assert resp.json()["code"] == "BLOG_NOT_FOUND"


# ── Extend trial ─────────────────────────────────────────────────────────────

def test_extend_running_trial_adds_days(client):
    admin = _superadmin(client)
    _, blog_id, owner_id, _ = _register(client)
    ends = _future(3)
    _set_subscription(blog_id, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=ends)

    resp = client.post(f"/superadmin/subscriptions/{blog_id}/extend-trial", json={"days": 7}, headers=admin)

    assert resp.status_code == 200, resp.text
    # SQLite hands back dates without a timezone; they're UTC (see app.core.datetimes).
    new_end = as_utc(datetime.fromisoformat(resp.json()["trial_ends_at"].replace("Z", "+00:00")))
    assert abs((new_end - (ends + timedelta(days=7))).total_seconds()) < 2
    assert resp.json()["category"] == "trialing"
    with Session(engine) as session:
        assert session.exec(select(AuditLog).where(AuditLog.blog_id == blog_id, AuditLog.action == "billing.trial_extended")).first()
        assert session.exec(select(Notification).where(Notification.user_id == owner_id, Notification.type == "billing_trial_extended")).first()


def test_extend_trial_on_free_workspace_needs_a_plan(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)

    missing = client.post(f"/superadmin/subscriptions/{blog_id}/extend-trial", json={"days": 14}, headers=admin)
    assert missing.status_code == 400

    resp = client.post(f"/superadmin/subscriptions/{blog_id}/extend-trial", json={"days": 14, "plan": "team"}, headers=admin)
    assert resp.status_code == 200, resp.text
    assert resp.json()["effective_plan"] == "team"
    assert resp.json()["trial_used"] is True


def test_extend_trial_rejects_out_of_range_days(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    resp = client.post(f"/superadmin/subscriptions/{blog_id}/extend-trial", json={"days": 0, "plan": "pro"}, headers=admin)
    assert resp.status_code == 422


# ── Grant plan ───────────────────────────────────────────────────────────────

def test_grant_plan_with_and_without_end_date(client):
    admin = _superadmin(client)
    _, blog_id, owner_id, _ = _register(client)

    forever = client.post(f"/superadmin/subscriptions/{blog_id}/grant", json={"plan": "team"}, headers=admin)
    assert forever.status_code == 200, forever.text
    assert forever.json()["effective_plan"] == "team"
    assert forever.json()["category"] == "granted"
    assert forever.json()["current_period_ends_at"] is None

    until = _future(30).isoformat()
    limited = client.post(f"/superadmin/subscriptions/{blog_id}/grant", json={"plan": "pro", "until": until}, headers=admin)
    assert limited.status_code == 200, limited.text
    assert limited.json()["effective_plan"] == "pro"
    assert limited.json()["current_period_ends_at"] is not None

    with Session(engine) as session:
        assert session.exec(select(Notification).where(Notification.user_id == owner_id, Notification.type == "billing_plan_granted")).first()


def test_grant_free_revokes_a_granted_plan(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    client.post(f"/superadmin/subscriptions/{blog_id}/grant", json={"plan": "team"}, headers=admin)

    resp = client.post(f"/superadmin/subscriptions/{blog_id}/grant", json={"plan": "free"}, headers=admin)

    assert resp.status_code == 200, resp.text
    assert resp.json()["effective_plan"] == "free"


def test_grant_rejects_past_end_date(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    resp = client.post(
        f"/superadmin/subscriptions/{blog_id}/grant",
        json={"plan": "pro", "until": _future(-1).isoformat()},
        headers=admin,
    )
    assert resp.status_code == 400


def test_paying_workspace_cannot_be_changed_by_hand(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    _set_subscription(blog_id, plan=SubscriptionPlan.PRO, status="active", billing_interval="monthly",
                      paystack_subscription_code=f"SUB_{uuid.uuid4().hex[:8]}", current_period_ends_at=_future(20))

    grant = client.post(f"/superadmin/subscriptions/{blog_id}/grant", json={"plan": "team"}, headers=admin)
    extend = client.post(f"/superadmin/subscriptions/{blog_id}/extend-trial", json={"days": 7}, headers=admin)

    for resp in (grant, extend):
        assert resp.status_code in (400, 409), resp.text
        assert resp.json()["code"] == "OPERATION_NOT_ALLOWED"
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).one()
        assert subscription.plan == SubscriptionPlan.PRO



# ── End trial ────────────────────────────────────────────────────────────────

def test_end_running_trial(client):
    admin = _superadmin(client)
    _, blog_id, owner_id, _ = _register(client)
    _set_subscription(blog_id, plan=SubscriptionPlan.TEAM, status="trialing", trial_used=True, trial_ends_at=_future(9))

    resp = client.post(f"/superadmin/subscriptions/{blog_id}/end-trial", json={"reason": "Duplicate signup"}, headers=admin)

    assert resp.status_code == 200, resp.text
    assert resp.json()["effective_plan"] == "free"
    assert resp.json()["category"] == "free"
    assert resp.json()["trial_used"] is True
    with Session(engine) as session:
        log = session.exec(select(AuditLog).where(AuditLog.blog_id == blog_id, AuditLog.action == "billing.trial_ended")).one()
        assert "Duplicate signup" in log.details
        assert session.exec(select(Notification).where(Notification.user_id == owner_id, Notification.type == "billing_trial_ended")).first()


def test_end_trial_needs_a_reason(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    _set_subscription(blog_id, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=_future(5))
    resp = client.post(f"/superadmin/subscriptions/{blog_id}/end-trial", json={"reason": ""}, headers=admin)
    assert resp.status_code == 422


def test_end_trial_refuses_when_no_trial_is_running(client):
    admin = _superadmin(client)
    _, blog_id, _, _ = _register(client)
    _set_subscription(blog_id, plan=SubscriptionPlan.PRO, status="trialing", trial_used=True, trial_ends_at=_future(-1))

    resp = client.post(f"/superadmin/subscriptions/{blog_id}/end-trial", json={"reason": "Testing"}, headers=admin)

    assert resp.status_code == 400
    assert resp.json()["code"] == "OPERATION_NOT_ALLOWED"
