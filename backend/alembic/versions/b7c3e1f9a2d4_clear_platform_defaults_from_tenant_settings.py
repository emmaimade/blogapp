"""clear platform defaults from tenant settings

The general/contact settings schemas used to default to the platform's own
identity ("Inko", "Your ideas, amplified", hello@inko.blog, San Francisco…),
and those defaults were saved into every new blog's settings. Tenants that
never changed them showed the platform's brand on their public blog.

This clears only values that still exactly match those old defaults: general
fields fall back to the blog's own name/tagline/description, and contact
fields are emptied (the public contact page hides empty fields, and contact
messages go to the blog owner when no address is set).

Revision ID: b7c3e1f9a2d4
Revises: a4f7d9c2e6b1
Create Date: 2026-10-06 00:00:00.000000

"""
import json

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b7c3e1f9a2d4"
down_revision = "a4f7d9c2e6b1"
branch_labels = None
depends_on = None

OLD_SITE_NAME = "Inko"
OLD_TAGLINES = {"Your ideas, amplified", "Your ideas, amplified."}
OLD_DESCRIPTION = "A modern blog CMS for sharing your stories and ideas"
OLD_CONTACT_EMAIL = "hello@inko.blog"
OLD_LOCATION = "San Francisco, CA"
OLD_RESPONSE_TIME = "Usually within 24-48 hours"


def _clean_general(value: dict, blog_tagline, blog_description) -> bool:
    changed = False
    if value.get("site_name") == OLD_SITE_NAME:
        value["site_name"] = ""
        changed = True
    if value.get("site_tagline") in OLD_TAGLINES:
        value["site_tagline"] = blog_tagline if blog_tagline and blog_tagline not in OLD_TAGLINES else ""
        changed = True
    if value.get("site_description") == OLD_DESCRIPTION:
        value["site_description"] = blog_description or ""
        changed = True
    return changed


def _clean_contact(value: dict) -> bool:
    changed = False
    if value.get("contact_email") == OLD_CONTACT_EMAIL:
        value["contact_email"] = None
        changed = True
    if value.get("location") == OLD_LOCATION:
        value["location"] = ""
        changed = True
    if value.get("response_time") == OLD_RESPONSE_TIME:
        value["response_time"] = ""
        changed = True
    return changed


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT s.id, s.setting_key, s.setting_value, b.tagline, b.description "
            "FROM site_settings s JOIN blog b ON b.id = s.blog_id "
            "WHERE s.setting_key IN ('general', 'contact')"
        )
    ).fetchall()

    for row_id, key, raw_value, blog_tagline, blog_description in rows:
        try:
            value = json.loads(raw_value)
        except (TypeError, ValueError):
            continue
        if not isinstance(value, dict):
            continue

        changed = (
            _clean_general(value, blog_tagline, blog_description)
            if key == "general"
            else _clean_contact(value)
        )
        if changed:
            bind.execute(
                sa.text("UPDATE site_settings SET setting_value = :value WHERE id = :id"),
                {"value": json.dumps(value), "id": row_id},
            )


def downgrade() -> None:
    # Data cleanup only: the removed values were platform placeholders, not
    # tenant data, so there is nothing meaningful to restore.
    pass
