"""add post revisions

Saved versions of posts for the editor's History panel (post_revisions).
Existing posts start with no history; their next save is their first version.

Revision ID: d4b8f6a2c9e3
Revises: c7e3a9d1f5b2
Create Date: 2026-10-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4b8f6a2c9e3"
down_revision = "c7e3a9d1f5b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "post_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("post.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("thumbnail_url", sa.String(), nullable=True),
        sa.Column("saved_by_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(length=20), nullable=False, server_default="saved"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_post_revisions_post_id", "post_revisions", ["post_id"])
    op.create_index("ix_post_revisions_created_at", "post_revisions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_post_revisions_created_at", table_name="post_revisions")
    op.drop_index("ix_post_revisions_post_id", table_name="post_revisions")
    op.drop_table("post_revisions")
