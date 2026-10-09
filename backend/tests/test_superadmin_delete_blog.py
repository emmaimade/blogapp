"""
DELETE /superadmin/blogs/{id}. Every blog has site settings, so the delete
has to leave them to the database's ON DELETE CASCADE rather than have the
ORM null their blog_id (NOT NULL); and the audit entry recording the delete
must survive it, so it can't be linked to the blog it describes.
"""

import json
import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import AuditLog, Blog, SiteSettings, User


def _register(client) -> tuple[dict, int, int]:
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
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _superadmin(client) -> dict:
    headers, _, user_id = _register(client)
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.is_super_admin = True
        session.add(user)
        session.commit()
    return headers


def _workspace_with_settings(client) -> int:
    """POST /blogs/ seeds site settings (sign-up's first workspace doesn't)."""
    headers, _, _ = _register(client)
    res = client.post("/blogs/", json={"name": f"Extra {uuid.uuid4().hex[:6]}"}, headers=headers)
    assert res.status_code == 200, res.text
    blog_id = res.json()["id"]
    with Session(engine) as session:
        assert session.exec(select(SiteSettings).where(SiteSettings.blog_id == blog_id)).first() is not None
    return blog_id


def test_superadmin_can_delete_a_blog_with_settings(client):
    blog_id = _workspace_with_settings(client)
    admin = _superadmin(client)

    res = client.delete(f"/superadmin/blogs/{blog_id}", headers=admin)

    assert res.status_code == 204, res.text
    with Session(engine) as session:
        assert session.get(Blog, blog_id) is None


def test_deleting_a_blog_keeps_its_audit_entry(client):
    blog_id = _workspace_with_settings(client)
    admin = _superadmin(client)

    assert client.delete(f"/superadmin/blogs/{blog_id}", headers=admin).status_code == 204

    with Session(engine) as session:
        entries = session.exec(
            select(AuditLog).where(AuditLog.action == "superadmin.blog_delete", AuditLog.resource_id == blog_id)
        ).all()
    assert len(entries) == 1
    # Not linked to the blog: audit_logs.blog_id cascades, which would take
    # the record of the delete away with the blog.
    assert entries[0].blog_id is None
    assert json.loads(entries[0].details)["blog_id"] == blog_id


def test_deleting_an_unknown_blog_is_404(client):
    admin = _superadmin(client)

    assert client.delete("/superadmin/blogs/99999999", headers=admin).status_code == 404
