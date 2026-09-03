"""
GET /blogs/{blog_id}/settings/all is admin-only (require_blog_owner), but the
public blog frontend needs the same aggregate for anonymous visitors — it was
calling /all directly, silently failing auth and falling back to hardcoded
"Inko" branding for every real tenant. /public is the anonymous-safe aggregate.
"""

import json
import uuid

import pytest
from sqlmodel import Session

from app.core.db import engine
from app.models.settings import SiteSettings


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register_owner(client) -> tuple[str, int]:
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
    return body["access_token"], body["user"]["blog_memberships"][0]["blog_id"]


@pytest.fixture
def owner(client):
    return _register_owner(client)


def _set_general_setting(blog_id: int, site_name: str) -> None:
    with Session(engine) as session:
        session.add(
            SiteSettings(
                blog_id=blog_id,
                setting_key="general",
                setting_value=json.dumps({
                    "site_name": site_name,
                    "site_tagline": "Notes on computing",
                    "site_description": "A personal blog.",
                    "timezone": "UTC",
                    "language": "en",
                    "posts_per_page": 10,
                }),
            )
        )
        session.commit()


def test_public_settings_are_readable_without_auth(client, owner):
    _, blog_id = owner
    _set_general_setting(blog_id, "Ada's Notes")

    res = client.get(f"/blogs/{blog_id}/settings/public")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["general"]["site_name"] == "Ada's Notes"
    assert set(body.keys()) == {"general", "about", "footer", "branding", "seo", "contact"}


def test_all_settings_still_requires_owner_access(client, owner):
    _, blog_id = owner

    res = client.get(f"/blogs/{blog_id}/settings/all")
    assert res.status_code == 401
