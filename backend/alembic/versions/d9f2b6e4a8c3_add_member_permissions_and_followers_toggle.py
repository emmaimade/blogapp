"""add member permissions and followers toggle

blog_members.permissions: extra abilities an owner grants on top of a role
(the first is export_followers). The update endpoint already accepted a
permissions map, but there was no column to keep it in.

blog.followers_enabled: the blog's follow form on/off switch, on by default.

Revision ID: d9f2b6e4a8c3
Revises: c4e8a1d5f2b9
Create Date: 2026-10-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d9f2b6e4a8c3"
down_revision = "c4e8a1d5f2b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "blog_members",
        sa.Column("permissions", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "blog",
        sa.Column("followers_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("blog", "followers_enabled")
    op.drop_column("blog_members", "permissions")
