"""add sponsors

Sponsor slots a blog's owner runs on their blog (sponsors) and their daily
impressions and clicks (sponsor_daily), and enquiries from the blog's
"Advertise with us" page (advertise_enquiries).

Revision ID: a3c9e5f1d7b4
Revises: f6b2d8a4c1e7
Create Date: 2026-10-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a3c9e5f1d7b4"
down_revision = "f6b2d8a4c1e7"
branch_labels = None
depends_on = None

# Member names, as SQLModel stores str enums (see the other enum columns).
SPONSOR_PLACEMENT = sa.Enum("POST_END", "HOME", "SIDEBAR", name="sponsorplacement")


def upgrade() -> None:
    op.create_table(
        "sponsors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("tagline", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("placement", SPONSOR_PLACEMENT, nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=True),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sponsors_blog_id", "sponsors", ["blog_id"])

    op.create_table(
        "sponsor_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sponsor_id", sa.Integer(), sa.ForeignKey("sponsors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("sponsor_id", "day", name="uq_sponsor_daily_sponsor_day"),
    )
    op.create_index("ix_sponsor_daily_sponsor_id", "sponsor_daily", ["sponsor_id"])

    op.create_table(
        "advertise_enquiries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("company", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("budget", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_advertise_enquiries_blog_id", "advertise_enquiries", ["blog_id"])
    op.create_index("ix_advertise_enquiries_created_at", "advertise_enquiries", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_advertise_enquiries_created_at", table_name="advertise_enquiries")
    op.drop_index("ix_advertise_enquiries_blog_id", table_name="advertise_enquiries")
    op.drop_table("advertise_enquiries")
    op.drop_index("ix_sponsor_daily_sponsor_id", table_name="sponsor_daily")
    op.drop_table("sponsor_daily")
    op.drop_index("ix_sponsors_blog_id", table_name="sponsors")
    op.drop_table("sponsors")
    SPONSOR_PLACEMENT.drop(op.get_bind(), checkfirst=True)
