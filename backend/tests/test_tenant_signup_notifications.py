"""
Verifies that superadmins get notified when a new tenant signs up.

Covers both paths that create a Blog: the public registration flow
(/users/register, a brand-new user + workspace) and an existing user
creating an additional workspace (POST /blogs/).
"""

import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.models import User


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client, email: str, password: str = "correcthorse1", workspace_name: str | None = None):
    return client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": email,
            "password": password,
            "workspace_name": workspace_name or f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )


def _promote_to_superadmin(email: str):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        user.is_super_admin = True
        session.add(user)
        session.commit()


def test_registering_a_new_tenant_notifies_superadmins(client):
    admin_email = _unique_email()
    admin_resp = _register(client, admin_email)
    assert admin_resp.status_code == 200, admin_resp.text
    _promote_to_superadmin(admin_email)

    login = client.post(
        "/users/login",
        data={"username": admin_email, "password": "correcthorse1"},
    )
    assert login.status_code == 200, login.text
    admin_token = login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    before = client.get("/notifications/unread-count", headers=admin_headers)
    assert before.status_code == 200, before.text
    baseline = before.json()["count"]

    tenant_email = _unique_email()
    tenant_resp = _register(client, tenant_email, workspace_name="Brand New Tenant Co")
    assert tenant_resp.status_code == 200, tenant_resp.text
    new_blog_id = tenant_resp.json()["user"]["blog_memberships"][0]["blog_id"]

    after = client.get("/notifications/unread-count", headers=admin_headers)
    assert after.status_code == 200, after.text
    assert after.json()["count"] == baseline + 1

    listing = client.get("/notifications/", headers=admin_headers)
    assert listing.status_code == 200, listing.text
    notifications = listing.json()
    matches = [n for n in notifications if n["type"] == "tenant_signup" and n["blog_id"] == new_blog_id]
    assert len(matches) == 1, notifications

    notification = matches[0]
    assert "Brand New Tenant Co" in notification["body"]
    assert notification["link"] == f"/admin/blogs/{new_blog_id}"
    assert notification["read_at"] is None


def test_creating_an_additional_blog_notifies_superadmins(client):
    admin_email = _unique_email()
    admin_resp = _register(client, admin_email)
    assert admin_resp.status_code == 200, admin_resp.text
    _promote_to_superadmin(admin_email)

    login = client.post(
        "/users/login",
        data={"username": admin_email, "password": "correcthorse1"},
    )
    admin_token = login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    owner_email = _unique_email()
    owner_resp = _register(client, owner_email)
    owner_token = owner_resp.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    before = client.get("/notifications/unread-count", headers=admin_headers)
    baseline = before.json()["count"]

    create_resp = client.post(
        "/blogs/",
        json={
            "name": "Second Workspace",
            "slug": f"second-{uuid.uuid4().hex[:8]}",
            "subdomain": f"second-{uuid.uuid4().hex[:8]}",
        },
        headers=owner_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    new_blog_id = create_resp.json()["id"]

    after = client.get("/notifications/unread-count", headers=admin_headers)
    assert after.json()["count"] == baseline + 1

    listing = client.get("/notifications/", headers=admin_headers)
    matches = [
        n for n in listing.json()
        if n["type"] == "tenant_signup" and n["blog_id"] == new_blog_id
    ]
    assert len(matches) == 1, listing.json()
    assert matches[0]["link"] == f"/admin/blogs/{new_blog_id}"
