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
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
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
    return client.cookies.get(ACCESS_TOKEN_COOKIE_NAME), body["user"]["blog_memberships"][0]["blog_id"]


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

    # Registering set the owner's session as cookies on this client — clear
    # them so the request genuinely carries no credentials, the same as it
    # would have with no Authorization header before cookie-based auth.
    client.cookies.clear()
    res = client.get(f"/blogs/{blog_id}/settings/all")
    assert res.status_code == 401


# ── Post layout (branding) ────────────────────────────────────────────────────

def _complete_onboarding(blog_id: int) -> None:
    """Saving settings needs a finished onboarding wizard, which these tests
    don't exercise — set it directly, as other test files do."""
    from app.models import Blog
    from app.models.blog import OnboardingStatus

    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(blog)
        session.commit()


def _branding_payload(**overrides) -> dict:
    return {
        "primary_color": "#9333EA",
        "secondary_color": "#18181B",
        "accent_color": "#A855F7",
        "font_heading": "Inter",
        "font_body": "Inter",
        **overrides,
    }


def test_post_layouts_default_to_feed_and_list(client, owner):
    _, blog_id = owner

    branding = client.get(f"/blogs/{blog_id}/settings/public").json()["branding"]

    assert branding["home_layout"] == "feed"
    assert branding["archive_layout"] == "list"


def test_post_layout_choice_is_saved_and_public(client, owner):
    token, blog_id = owner
    _complete_onboarding(blog_id)

    res = client.post(
        f"/blogs/{blog_id}/settings/branding",
        json=_branding_payload(home_layout="cards", archive_layout="feed"),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text

    branding = client.get(f"/blogs/{blog_id}/settings/public").json()["branding"]
    assert branding["home_layout"] == "cards"
    assert branding["archive_layout"] == "feed"


def test_unknown_post_layout_is_rejected(client, owner):
    token, blog_id = owner
    _complete_onboarding(blog_id)

    res = client.post(
        f"/blogs/{blog_id}/settings/branding",
        json=_branding_payload(home_layout="masonry"),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in (400, 422), res.text

    # Nothing was saved — the defaults still apply.
    branding = client.get(f"/blogs/{blog_id}/settings/public").json()["branding"]
    assert branding["home_layout"] == "feed"


@pytest.mark.parametrize("layout", ["feed", "list", "cards", "compact"])
def test_every_post_layout_can_be_saved(client, owner, layout):
    token, blog_id = owner
    _complete_onboarding(blog_id)

    res = client.post(
        f"/blogs/{blog_id}/settings/branding",
        json=_branding_payload(home_layout=layout, archive_layout=layout),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["archive_layout"] == layout
