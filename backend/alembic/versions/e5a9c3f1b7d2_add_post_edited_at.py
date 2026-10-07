"""add post edited_at

`updated_at` changes on every write to a post row — including the view-count
bump on each read, featuring and status changes — so it can't tell readers
when the article itself was last revised. `edited_at` records only content
edits (title, body, thumbnail, tags, post type) made after the post first
went live, and is what the blog shows as "Updated".

Existing posts start with no edit date: their past edits can't be told apart
from view bumps in `updated_at`.

Revision ID: e5a9c3f1b7d2
Revises: d2f6b8c1e9a3
Create Date: 2026-10-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e5a9c3f1b7d2"
down_revision = "d2f6b8c1e9a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("post", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("post", "edited_at")
