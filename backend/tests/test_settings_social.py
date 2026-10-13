"""
Social links are one shared setting ("social"), shown by the About, Contact
and footer sections. Each of those used to keep its own copy; until a blog
saves the shared setting, the links are merged from those copies.
"""

import importlib
import io
import json
import uuid

import pytest
from sqlmodel import Session

from app.core.db import engine
from app.core.exceptions import BadRequestError
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Blog
from app.models.blog import OnboardingStatus
from app.models.settings import SiteSettings

# See test_settings_uploads.py for why this goes through importlib.
settings_router = importlib.import_module("app.modules.settings.router")


def _register_owner(client) -> tuple[str, int]:
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
    blog_id = resp.json()["user"]["blog_memberships"][0]["blog_id"]
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(blog)
        session.commit()
    return client.cookies.get(ACCESS_TOKEN_COOKIE_NAME), blog_id


@pytest.fixture
def owner(client):
    return _register_owner(client)


def _store(blog_id: int, key: str, value: dict) -> None:
    with Session(engine) as session:
        session.add(SiteSettings(blog_id=blog_id, setting_key=key, setting_value=json.dumps(value)))
        session.commit()


def test_links_are_merged_from_the_old_per_section_copies(client, owner):
    _, blog_id = owner
    _store(blog_id, "contact", {"social_links": {"github": "https://github.com/from-contact"}})
    _store(blog_id, "footer", {"social_links": {
        "github": "https://github.com/from-footer",
        "youtube": "https://youtube.com/@from-footer",
    }})
    _store(blog_id, "about_page", {"social_links": {"linkedin": "https://linkedin.com/in/from-about"}})

    social = client.get(f"/blogs/{blog_id}/settings/social").json()

    # Contact wins over footer for the same network; every network is kept.
    assert social["github"] == "https://github.com/from-contact"
    assert social["youtube"] == "https://youtube.com/@from-footer"
    assert social["linkedin"] == "https://linkedin.com/in/from-about"


def test_saved_links_are_shown_by_every_section(client, owner):
    token, blog_id = owner
    _store(blog_id, "footer", {"social_links": {"github": "https://github.com/old"}})

    res = client.post(
        f"/blogs/{blog_id}/settings/social",
        json={"github": "https://github.com/ada", "twitter": "https://x.com/ada"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text

    for section in ("about", "footer", "contact"):
        links = client.get(f"/blogs/{blog_id}/settings/{section}").json()["social_links"]
        assert links["github"] == "https://github.com/ada", section
        assert links["twitter"] == "https://x.com/ada", section

    public = client.get(f"/blogs/{blog_id}/settings/public").json()
    for section in ("about", "footer", "contact"):
        assert public[section]["social_links"]["github"] == "https://github.com/ada", section


def test_saving_a_section_does_not_change_the_shared_links(client, owner):
    token, blog_id = owner
    client.post(
        f"/blogs/{blog_id}/settings/social",
        json={"github": "https://github.com/ada"},
        headers={"Authorization": f"Bearer {token}"},
    )

    res = client.post(
        f"/blogs/{blog_id}/settings/contact",
        json={"social_links": {"github": "https://github.com/someone-else"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text

    assert client.get(f"/blogs/{blog_id}/settings/contact").json()["social_links"]["github"] == "https://github.com/ada"


def test_about_social_links_can_be_hidden(client, owner):
    token, blog_id = owner
    assert client.get(f"/blogs/{blog_id}/settings/about").json()["show_social_links"] is True

    res = client.post(
        f"/blogs/{blog_id}/settings/about",
        json={"show_social_links": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    assert client.get(f"/blogs/{blog_id}/settings/public").json()["about"]["show_social_links"] is False


def test_social_links_need_owner_access_to_save(client, owner):
    _, blog_id = owner
    client.cookies.clear()
    res = client.post(f"/blogs/{blog_id}/settings/social", json={"github": "https://github.com/x"})
    assert res.status_code == 401


def test_footer_defaults_still_come_from_the_blog(client, owner):
    _, blog_id = owner
    footer = client.get(f"/blogs/{blog_id}/settings/footer").json()
    assert "Powered by INKO" in footer["copyright_text"]


class _FakeUploadFile:
    def __init__(self, content_type):
        self.content_type = content_type
        self.file = io.BytesIO(b"<svg/>")
        self.size = 6


def test_og_image_upload_rejects_svg_with_its_own_message():
    with pytest.raises(BadRequestError) as excinfo:
        settings_router.upload_og_image(blog_id=1, file=_FakeUploadFile("image/svg+xml"))
    assert excinfo.value.code == "INVALID_FILE_TYPE"
    assert "SVG" not in excinfo.value.message


# ── Footer on the Free plan ───────────────────────────────────────────────────

def test_free_blog_can_save_a_footer_it_never_saved(client, owner):
    """The footer it was shown carries the blog's default copyright; sending
    that back unchanged isn't an edit, so the Free plan doesn't block it."""
    token, blog_id = owner
    footer = client.get(f"/blogs/{blog_id}/settings/footer").json()

    res = client.post(
        f"/blogs/{blog_id}/settings/footer",
        json={**footer, "show_categories": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    assert client.get(f"/blogs/{blog_id}/settings/footer").json()["show_categories"] is False


def test_free_blog_still_cannot_change_the_copyright(client, owner):
    token, blog_id = owner
    footer = client.get(f"/blogs/{blog_id}/settings/footer").json()

    res = client.post(
        f"/blogs/{blog_id}/settings/footer",
        json={**footer, "copyright_text": "© Ada"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403, res.text
