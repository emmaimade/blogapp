"""add blog comment bans

Lets a workspace owner or editor block a user from commenting on their blog.
One row per (blog, user); the user's existing comments are left as they are.

Revision ID: e1a7c3d5f9b2
Revises: c8e2f4a6b9d1
Create Date: 2026-10-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e1a7c3d5f9b2"
down_revision = "c8e2f4a6b9d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_comment_bans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("banned_by_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("blog_id", "user_id", name="uq_blog_comment_bans_blog_user"),
    )
    op.create_index("ix_blog_comment_bans_blog_id", "blog_comment_bans", ["blog_id"])
    op.create_index("ix_blog_comment_bans_user_id", "blog_comment_bans", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_blog_comment_bans_user_id", table_name="blog_comment_bans")
    op.drop_index("ix_blog_comment_bans_blog_id", table_name="blog_comment_bans")
    op.drop_table("blog_comment_bans")
