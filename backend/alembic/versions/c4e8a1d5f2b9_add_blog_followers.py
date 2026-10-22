"""add blog followers

Readers following a blog by email, with double opt-in: blog_followers.

Revision ID: c4e8a1d5f2b9
Revises: b7d3f9a2c6e1
Create Date: 2026-10-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c4e8a1d5f2b9"
down_revision = "b7d3f9a2c6e1"
branch_labels = None
depends_on = None

# Member names, as SQLModel stores str enums (see the other enum columns).
FOLLOWER_STATUS = sa.Enum("PENDING", "ACTIVE", "UNSUBSCRIBED", name="followerstatus")


def upgrade() -> None:
    op.create_table(
        "blog_followers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("status", FOLLOWER_STATUS, nullable=False),
        sa.Column("confirm_token_hash", sa.String(), nullable=True),
        sa.Column("confirm_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirm_send_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_post_id", sa.Integer(), sa.ForeignKey("post.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("blog_id", "email", name="uq_blog_followers_blog_email"),
    )
    op.create_index("ix_blog_followers_blog_id", "blog_followers", ["blog_id"])
    op.create_index("ix_blog_followers_confirm_token_hash", "blog_followers", ["confirm_token_hash"])


def downgrade() -> None:
    op.drop_index("ix_blog_followers_confirm_token_hash", table_name="blog_followers")
    op.drop_index("ix_blog_followers_blog_id", table_name="blog_followers")
    op.drop_table("blog_followers")
    FOLLOWER_STATUS.drop(op.get_bind(), checkfirst=True)
