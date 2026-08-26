"""
Coverage for the public subdomain-resolution endpoint no longer resolving a
deactivated blog.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[str, int, int]:
    """Registers a brand-new user + workspace, returns (access_token, blog_id, user_id)."""
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
    return body["access_token"], body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def test_subdomain_lookup_finds_an_active_blog(client):
    token, blog_id, _user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/blogs/me", headers=headers)
    assert me.status_code == 200, me.text
    subdomain = next(b["subdomain"] for b in me.json() if b["id"] == blog_id)

    res = client.get(f"/blogs/by-subdomain/{subdomain}")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == blog_id


def test_subdomain_lookup_404s_once_the_blog_is_deactivated(client):
    from app.models import Blog

    token, blog_id, _user_id = _register_owner(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/blogs/me", headers=headers)
    subdomain = next(b["subdomain"] for b in me.json() if b["id"] == blog_id)

    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.is_active = False
        session.add(blog)
        session.commit()

    res = client.get(f"/blogs/by-subdomain/{subdomain}")
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "BLOG_NOT_FOUND"
