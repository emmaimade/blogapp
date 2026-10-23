"""add blog source daily

Traffic sources for the studio's Analytics page: visits per blog per day by
where they came from (blog_source_daily). Only the source name is kept.

Revision ID: e1a7c3f9b5d2
Revises: d9f2b6e4a8c3
Create Date: 2026-10-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e1a7c3f9b5d2"
down_revision = "d9f2b6e4a8c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_source_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("visits", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("blog_id", "day", "source", name="uq_blog_source_daily_blog_day_source"),
    )
    op.create_index("ix_blog_source_daily_blog_id", "blog_source_daily", ["blog_id"])


def downgrade() -> None:
    op.drop_index("ix_blog_source_daily_blog_id", table_name="blog_source_daily")
    op.drop_table("blog_source_daily")
