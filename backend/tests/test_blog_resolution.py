"""
Coverage for the subdomain/custom-domain tenant-resolution hardening:
GET /blogs/resolve (subdomain + custom domain, both backward-compatible with
the existing by-subdomain lookup) and the new validation on PATCH /blogs/{id}
for custom_domain (format + uniqueness).
"""

import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Blog, BlogSubscription, SubscriptionPlan, User
from app.models.blog import OnboardingStatus


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[str, int, int, str]:
    """Returns (access_token, blog_id, user_id, subdomain)."""
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
    membership = body["user"]["blog_memberships"][0]
    return client.cookies.get(ACCESS_TOKEN_COOKIE_NAME), membership["blog_id"], body["user"]["id"], membership["blog"]["subdomain"]


def _complete_onboarding_and_verify_email(blog_id: int, user_id: int) -> None:
    """
    Bypasses the full onboarding wizard (irrelevant to what these tests check)
    the same way other test files direct-insert around unrelated preconditions.
    """
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(blog)
        user = session.get(User, user_id)
        user.email_verified = True
        session.add(user)
        session.commit()


def _give_pro_plan(blog_id: int) -> None:
    """Custom domains need a paid plan; see test_plan_limits for that rule."""
    with Session(engine) as session:
        subscription = session.exec(select(BlogSubscription).where(BlogSubscription.blog_id == blog_id)).first()
        subscription = subscription or BlogSubscription(blog_id=blog_id)
        subscription.plan = SubscriptionPlan.PRO
        subscription.status = "active"
        session.add(subscription)
        session.commit()


# ── resolve_blog_by_host ──────────────────────────────────────────────────────

def test_resolve_by_host_matches_a_subdomain(client):
    _, blog_id, _, subdomain = _register_owner(client)
    res = client.get(f"/blogs/resolve?host={subdomain}.inko.blog")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == blog_id


def test_resolve_by_host_is_case_insensitive(client):
    _, blog_id, _, subdomain = _register_owner(client)
    res = client.get(f"/blogs/resolve?host={subdomain.upper()}.INKO.BLOG")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == blog_id


def test_resolve_by_host_matches_a_custom_domain(client):
    token, blog_id, user_id, _ = _register_owner(client)
    _complete_onboarding_and_verify_email(blog_id, user_id)
    _give_pro_plan(blog_id)
    headers = {"Authorization": f"Bearer {token}"}

    domain = f"blog-{uuid.uuid4().hex[:8]}.example.com"
    patch = client.patch(f"/blogs/{blog_id}", json={"custom_domain": domain}, headers=headers)
    assert patch.status_code == 200, patch.text

    res = client.get(f"/blogs/resolve?host={domain}")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == blog_id


def test_resolve_by_host_404s_for_unknown_host(client):
    res = client.get("/blogs/resolve?host=nobody-here.inko.blog")
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "BLOG_NOT_FOUND"


def test_resolve_by_host_404s_for_inactive_blog(client):
    _, blog_id, _, subdomain = _register_owner(client)
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.is_active = False
        session.add(blog)
        session.commit()

    res = client.get(f"/blogs/resolve?host={subdomain}.inko.blog")
    assert res.status_code == 404, res.text


def test_by_subdomain_endpoint_still_works_unchanged(client):
    """Backward compatibility — the original endpoint wasn't replaced."""
    _, blog_id, _, subdomain = _register_owner(client)
    res = client.get(f"/blogs/by-subdomain/{subdomain}")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == blog_id


# ── custom_domain validation on PATCH /blogs/{id} ────────────────────────────

def test_update_blog_rejects_malformed_custom_domain(client):
    token, blog_id, user_id, _ = _register_owner(client)
    _complete_onboarding_and_verify_email(blog_id, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.patch(f"/blogs/{blog_id}", json={"custom_domain": "not a domain"}, headers=headers)
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "INVALID_INPUT"


def test_update_blog_rejects_duplicate_custom_domain(client):
    token1, blog_id1, user_id1, _ = _register_owner(client)
    _complete_onboarding_and_verify_email(blog_id1, user_id1)
    _give_pro_plan(blog_id1)
    headers1 = {"Authorization": f"Bearer {token1}"}

    domain = f"taken-{uuid.uuid4().hex[:8]}.example.com"
    first = client.patch(f"/blogs/{blog_id1}", json={"custom_domain": domain}, headers=headers1)
    assert first.status_code == 200, first.text

    token2, blog_id2, user_id2, _ = _register_owner(client)
    _complete_onboarding_and_verify_email(blog_id2, user_id2)
    _give_pro_plan(blog_id2)
    headers2 = {"Authorization": f"Bearer {token2}"}

    second = client.patch(f"/blogs/{blog_id2}", json={"custom_domain": domain}, headers=headers2)
    assert second.status_code == 409, second.text
    assert second.json()["code"] == "RESOURCE_ALREADY_EXISTS"


def test_update_blog_accepts_a_valid_custom_domain(client):
    token, blog_id, user_id, _ = _register_owner(client)
    _complete_onboarding_and_verify_email(blog_id, user_id)
    _give_pro_plan(blog_id)
    headers = {"Authorization": f"Bearer {token}"}

    domain = f"MyBlog-{uuid.uuid4().hex[:8]}.Example.com"
    res = client.patch(f"/blogs/{blog_id}", json={"custom_domain": domain}, headers=headers)
    assert res.status_code == 200, res.text
    # Normalized to lowercase.
    assert res.json()["custom_domain"] == domain.lower()
