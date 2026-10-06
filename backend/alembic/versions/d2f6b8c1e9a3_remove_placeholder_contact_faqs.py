"""remove placeholder contact FAQs

The contact settings schema used to default `faqs` to three platform
examples ("Open for freelance?", "Speaking engagements?", "Guest posting?"),
and saving the contact settings stored them as if the blog owner had written
them — so they showed on the public contact page.

This removes only entries whose question AND answer still exactly match one
of those examples; anything the owner wrote or edited is kept.

Revision ID: d2f6b8c1e9a3
Revises: c5e8a1d3f7b2
Create Date: 2026-10-07 00:00:00.000000

"""
import json

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d2f6b8c1e9a3"
down_revision = "c5e8a1d3f7b2"
branch_labels = None
depends_on = None

PLACEHOLDER_FAQS = {
    ("Open for freelance?", "Yes, currently accepting select projects."),
    ("Speaking engagements?", "Always interested in tech conferences and meetups."),
    ("Guest posting?", "Open to high-quality technical content collaborations."),
}


def without_placeholder_faqs(value: dict) -> bool:
    """Drop the placeholder FAQs from a contact settings dict in place.
    Returns whether anything changed."""
    faqs = value.get("faqs")
    if not isinstance(faqs, list):
        return False
    kept = [
        faq for faq in faqs
        if not (
            isinstance(faq, dict)
            and (faq.get("question"), faq.get("answer")) in PLACEHOLDER_FAQS
        )
    ]
    if len(kept) == len(faqs):
        return False
    value["faqs"] = kept
    return True


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, setting_value FROM site_settings WHERE setting_key = 'contact'")
    ).fetchall()

    for row_id, raw_value in rows:
        try:
            value = json.loads(raw_value)
        except (TypeError, ValueError):
            continue
        if isinstance(value, dict) and without_placeholder_faqs(value):
            bind.execute(
                sa.text("UPDATE site_settings SET setting_value = :value WHERE id = :id"),
                {"value": json.dumps(value), "id": row_id},
            )


def downgrade() -> None:
    # Data cleanup only: the removed entries were platform placeholders, not
    # the owner's content, so there is nothing meaningful to restore.
    pass
