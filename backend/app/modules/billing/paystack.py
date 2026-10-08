"""
Thin Paystack API client — only the calls billing uses.

Every call goes through `_request`, which turns a missing key into
BILLING_NOT_CONFIGURED and any transport or Paystack-side failure into
PAYMENT_PROVIDER_ERROR. Paystack's own error text goes to the log only.
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.error_codes import ErrorCode
from app.core.exceptions import ExternalServiceError
from app.models.blog import BillingInterval, SubscriptionPlan

logger = logging.getLogger(__name__)

BASE_URL = "https://api.paystack.co"
TIMEOUT_SECONDS = 15.0


def plan_code_for(plan: SubscriptionPlan, interval: BillingInterval) -> Optional[str]:
    return {
        (SubscriptionPlan.PRO, BillingInterval.MONTHLY): settings.PAYSTACK_PLAN_PRO_MONTHLY,
        (SubscriptionPlan.PRO, BillingInterval.YEARLY): settings.PAYSTACK_PLAN_PRO_YEARLY,
        (SubscriptionPlan.TEAM, BillingInterval.MONTHLY): settings.PAYSTACK_PLAN_TEAM_MONTHLY,
        (SubscriptionPlan.TEAM, BillingInterval.YEARLY): settings.PAYSTACK_PLAN_TEAM_YEARLY,
    }.get((plan, interval))


def plan_for_code(plan_code: Optional[str]) -> Optional[tuple[SubscriptionPlan, BillingInterval]]:
    """Reverse of plan_code_for — which of our plans a Paystack plan code is."""
    if not plan_code:
        return None
    for plan in (SubscriptionPlan.PRO, SubscriptionPlan.TEAM):
        for interval in BillingInterval:
            if plan_code_for(plan, interval) == plan_code:
                return plan, interval
    return None


def verify_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    """Paystack signs each webhook body with HMAC-SHA512 using the secret key."""
    if not signature or not settings.PAYSTACK_SECRET_KEY:
        return False
    expected = hmac.new(settings.PAYSTACK_SECRET_KEY.encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


def _request(method: str, path: str, json: Optional[dict] = None) -> Any:
    if not settings.PAYSTACK_SECRET_KEY:
        raise ExternalServiceError(
            ErrorCode.BILLING_NOT_CONFIGURED,
            log_message="PAYSTACK_SECRET_KEY is not set",
        )
    try:
        response = httpx.request(
            method,
            f"{BASE_URL}{path}",
            json=json,
            headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"},
            timeout=TIMEOUT_SECONDS,
        )
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ExternalServiceError(
            ErrorCode.PAYMENT_PROVIDER_ERROR,
            log_message=f"paystack {method} {path} failed: {exc}",
        ) from exc

    if response.status_code >= 400 or not body.get("status"):
        raise ExternalServiceError(
            ErrorCode.PAYMENT_PROVIDER_ERROR,
            log_message=f"paystack {method} {path} returned {response.status_code}: {body.get('message')}",
        )
    return body.get("data")


def fetch_plan(plan_code: str) -> dict:
    return _request("GET", f"/plan/{plan_code}")


def initialize_transaction(
    *,
    email: str,
    amount_kobo: int,
    plan_code: Optional[str],
    reference: str,
    callback_url: str,
    metadata: dict,
) -> dict:
    # With `plan` set Paystack charges the plan's amount and starts a
    # subscription once the charge succeeds; `amount` is still required.
    # Without it this is a one-off charge (used for the card check).
    body = {
        "email": email,
        "amount": amount_kobo,
        "reference": reference,
        "callback_url": callback_url,
        "metadata": metadata,
    }
    if plan_code:
        body["plan"] = plan_code
    return _request("POST", "/transaction/initialize", json=body)


def refund_transaction(reference: str) -> dict:
    """Refund a charge in full (used for the card check)."""
    return _request("POST", "/refund", json={"transaction": reference})


def verify_transaction(reference: str) -> dict:
    return _request("GET", f"/transaction/verify/{reference}")


def charge_authorization(
    *,
    email: str,
    amount_kobo: int,
    authorization_code: str,
    reference: str,
    metadata: dict,
) -> dict:
    """Charge a saved card without the owner present (used for prorated upgrades)."""
    return _request(
        "POST",
        "/transaction/charge_authorization",
        json={
            "email": email,
            "amount": amount_kobo,
            "authorization_code": authorization_code,
            "reference": reference,
            "metadata": metadata,
        },
    )


def create_subscription(*, customer: str, plan_code: str, authorization_code: str, start_date: datetime) -> dict:
    """
    Start a subscription on a saved card whose first charge is `start_date`,
    so a plan change never bills for time that's already paid for.
    """
    return _request(
        "POST",
        "/subscription",
        json={
            "customer": customer,
            "plan": plan_code,
            "authorization": authorization_code,
            "start_date": start_date.astimezone(timezone.utc).isoformat(),
        },
    )


def list_subscriptions(customer_id: int) -> list[dict]:
    """A customer's subscriptions (Paystack's first page, plenty for one customer)."""
    return _request("GET", f"/subscription?customer={customer_id}&perPage=50") or []


def disable_subscription(subscription_code: str, email_token: str) -> None:
    _request("POST", "/subscription/disable", json={"code": subscription_code, "token": email_token})


def get_manage_link(subscription_code: str) -> str:
    data = _request("GET", f"/subscription/{subscription_code}/manage/link")
    return data["link"]
