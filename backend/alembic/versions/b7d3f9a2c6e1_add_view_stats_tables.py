"""add view stats tables

Daily counters for the studio's view stats: post_view_daily (views per post
per day) and blog_visitor_daily (approximate readers per blog per day).
No backfill — history starts when this ships; Post.views keeps the lifetime
totals.

Revision ID: b7d3f9a2c6e1
Revises: ffa265fa7ff2
Create Date: 2026-10-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b7d3f9a2c6e1"
down_revision = "ffa265fa7ff2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "post_view_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("post.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("post_id", "day", name="uq_post_view_daily_post_day"),
    )
    op.create_index("ix_post_view_daily_blog_id", "post_view_daily", ["blog_id"])
    op.create_index("ix_post_view_daily_post_id", "post_view_daily", ["post_id"])
    op.create_index("ix_post_view_daily_day", "post_view_daily", ["day"])

    op.create_table(
        "blog_visitor_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("visitors", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("blog_id", "day", name="uq_blog_visitor_daily_blog_day"),
    )
    op.create_index("ix_blog_visitor_daily_blog_id", "blog_visitor_daily", ["blog_id"])


def downgrade() -> None:
    op.drop_index("ix_blog_visitor_daily_blog_id", table_name="blog_visitor_daily")
    op.drop_table("blog_visitor_daily")
    op.drop_index("ix_post_view_daily_day", table_name="post_view_daily")
    op.drop_index("ix_post_view_daily_post_id", table_name="post_view_daily")
    op.drop_index("ix_post_view_daily_blog_id", table_name="post_view_daily")
    op.drop_table("post_view_daily")
