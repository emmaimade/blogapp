"""
Contact FAQs are the owner's own: new blogs start with none, and the cleanup
migration removes only the old built-in placeholder FAQs, never the owner's.
"""

import importlib.util
import uuid
from pathlib import Path

from app.core.security import ACCESS_TOKEN_COOKIE_NAME

_MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "alembic" / "versions" / "d2f6b8c1e9a3_remove_placeholder_contact_faqs.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("remove_placeholder_contact_faqs", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _register_owner(client) -> int:
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
    assert client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    return resp.json()["user"]["blog_memberships"][0]["blog_id"]


def test_new_blog_has_no_faqs(client):
    blog_id = _register_owner(client)

    contact = client.get(f"/blogs/{blog_id}/settings/public").json()["contact"]

    assert contact["faqs"] == []


def test_cleanup_removes_only_exact_placeholder_faqs():
    migration = _load_migration()
    own_faq = {"question": "Do you take commissions?", "answer": "Yes — email me."}
    edited_placeholder = {"question": "Open for freelance?", "answer": "Not right now."}
    value = {
        "faqs": [
            {"question": "Open for freelance?", "answer": "Yes, currently accepting select projects."},
            own_faq,
            {"question": "Guest posting?", "answer": "Open to high-quality technical content collaborations."},
            edited_placeholder,
        ]
    }

    changed = migration.without_placeholder_faqs(value)

    assert changed is True
    assert value["faqs"] == [own_faq, edited_placeholder]


def test_cleanup_leaves_settings_without_placeholders_untouched():
    migration = _load_migration()
    value = {"faqs": [{"question": "Q", "answer": "A"}]}

    assert migration.without_placeholder_faqs(value) is False
    assert value == {"faqs": [{"question": "Q", "answer": "A"}]}
