"""add blog recommendations

Owners recommending other Inko blogs to their readers: blog_recommendations;
which recommendation brought a follower (blog_followers.referred_by_blog_id);
and the owner's opt-out from being recommended (blog.allow_recommendations).

Revision ID: c7e3a9d1f5b2
Revises: b8d4f2a6e9c1
Create Date: 2026-10-29 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c7e3a9d1f5b2"
down_revision = "b8d4f2a6e9c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recommended_blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("blog_id", "recommended_blog_id", name="uq_blog_recommendations_pair"),
    )
    op.create_index("ix_blog_recommendations_blog_id", "blog_recommendations", ["blog_id"])
    op.create_index("ix_blog_recommendations_recommended_blog_id", "blog_recommendations", ["recommended_blog_id"])

    op.add_column(
        "blog_followers",
        sa.Column("referred_by_blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "blog",
        sa.Column("allow_recommendations", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("blog", "allow_recommendations")
    op.drop_column("blog_followers", "referred_by_blog_id")
    op.drop_index("ix_blog_recommendations_recommended_blog_id", table_name="blog_recommendations")
    op.drop_index("ix_blog_recommendations_blog_id", table_name="blog_recommendations")
    op.drop_table("blog_recommendations")
