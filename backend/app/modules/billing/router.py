from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from app.core.db import get_session
from app.core.permissions import get_current_blog, require_blog_owner, require_super_admin
from app.core.security import get_current_user
from app.models import Blog, User
from app.schemas.billing import (
    AdminSubscriptionDetail,
    AdminSubscriptionList,
    BillingOverview,
    ChangePreview,
    CheckoutRequest,
    CheckoutResponse,
    EndTrialRequest,
    ExtendTrialRequest,
    GrantPlanRequest,
    ManageLinkResponse,
)

from . import admin_service, plan_change
from . import service as billing_service

router = APIRouter(tags=["billing"])


# ── Workspace billing (owner only) ───────────────────────────────────────────

@router.get(
    "/blogs/{blog_id}/billing",
    response_model=BillingOverview,
    dependencies=[Depends(require_blog_owner)],
)
def get_billing_overview(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    return billing_service.get_overview(blog, session)


@router.post(
    "/blogs/{blog_id}/billing/checkout",
    response_model=CheckoutResponse,
    dependencies=[Depends(require_blog_owner)],
)
def start_checkout(
    blog_id: int,
    payload: CheckoutRequest,
    request: Request,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    return billing_service.start_checkout(blog, payload, session, current_user, request=request)


@router.get(
    "/blogs/{blog_id}/billing/verify",
    response_model=BillingOverview,
    dependencies=[Depends(require_blog_owner)],
)
def verify_payment(
    blog_id: int,
    reference: str,
    request: Request,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    return billing_service.verify_payment(blog, reference, session, current_user, request=request)


@router.post(
    "/blogs/{blog_id}/billing/change/preview",
    response_model=ChangePreview,
    dependencies=[Depends(require_blog_owner)],
)
def preview_plan_change(
    blog_id: int,
    payload: CheckoutRequest,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    """What switching to this plan would cost and when it would apply. Changes nothing."""
    return plan_change.preview_change(blog, payload, session)


@router.post(
    "/blogs/{blog_id}/billing/change",
    response_model=BillingOverview,
    dependencies=[Depends(require_blog_owner)],
)
def change_plan(
    blog_id: int,
    payload: CheckoutRequest,
    request: Request,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    return plan_change.apply_change(blog, payload, session, current_user, request=request)


@router.post(
    "/blogs/{blog_id}/billing/change/undo",
    response_model=BillingOverview,
    dependencies=[Depends(require_blog_owner)],
)
def undo_plan_change(
    blog_id: int,
    request: Request,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    return plan_change.undo_pending_change(blog, session, current_user, request=request)


@router.post(
    "/blogs/{blog_id}/billing/cancel",
    response_model=BillingOverview,
    dependencies=[Depends(require_blog_owner)],
)
def cancel_subscription(
    blog_id: int,
    request: Request,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    return billing_service.cancel_subscription(blog, session, current_user, request=request)


@router.get(
    "/blogs/{blog_id}/billing/manage-link",
    response_model=ManageLinkResponse,
    dependencies=[Depends(require_blog_owner)],
)
def get_manage_link(
    blog_id: int,
    session: Session = Depends(get_session),
    blog: Blog = Depends(get_current_blog),
):
    return ManageLinkResponse(link=billing_service.get_manage_link(blog, session))


# ── Paystack webhook ─────────────────────────────────────────────────────────

@router.post("/billing/webhook", include_in_schema=False)
async def paystack_webhook(request: Request, session: Session = Depends(get_session)):
    # Authenticated by its HMAC signature, not a session — see service.
    # The handlers write their own audit entries; skip the generic http.post one.
    request.state.audit_logged = True
    raw_body = await request.body()
    billing_service.handle_webhook(
        raw_body,
        request.headers.get("x-paystack-signature"),
        session,
        request=request,
    )
    return {"status": "ok"}


# ── Superadmin ───────────────────────────────────────────────────────────────

@router.get(
    "/superadmin/subscriptions",
    response_model=AdminSubscriptionList,
    dependencies=[Depends(require_super_admin)],
)
def list_all_subscriptions(session: Session = Depends(get_session)):
    return admin_service.list_subscriptions(session)


@router.get(
    "/superadmin/subscriptions/{blog_id}",
    response_model=AdminSubscriptionDetail,
    dependencies=[Depends(require_super_admin)],
)
def get_subscription_detail(blog_id: int, session: Session = Depends(get_session)):
    return admin_service.get_subscription_detail(session, blog_id)


@router.post(
    "/superadmin/subscriptions/{blog_id}/extend-trial",
    response_model=AdminSubscriptionDetail,
    dependencies=[Depends(require_super_admin)],
)
def extend_trial(
    blog_id: int,
    payload: ExtendTrialRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return admin_service.extend_trial(session, blog_id, payload, current_user, request=request)


@router.post(
    "/superadmin/subscriptions/{blog_id}/grant",
    response_model=AdminSubscriptionDetail,
    dependencies=[Depends(require_super_admin)],
)
def grant_plan(
    blog_id: int,
    payload: GrantPlanRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return admin_service.grant_plan(session, blog_id, payload, current_user, request=request)


@router.post(
    "/superadmin/subscriptions/{blog_id}/end-trial",
    response_model=AdminSubscriptionDetail,
    dependencies=[Depends(require_super_admin)],
)
def end_trial(
    blog_id: int,
    payload: EndTrialRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return admin_service.end_trial(session, blog_id, payload, current_user, request=request)
