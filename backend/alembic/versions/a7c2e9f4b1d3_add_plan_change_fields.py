"""add plan change fields

Plan changes follow the usual subscription rules: upgrades apply at once and
charge the prorated difference to the saved card; downgrades wait for the end
of the paid period. That needs the reusable card authorization, a pending
plan for scheduled downgrades, and when the current period started.

Revision ID: a7c2e9f4b1d3
Revises: f3b8d2a6c1e4
Create Date: 2026-10-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a7c2e9f4b1d3"
down_revision = "f3b8d2a6c1e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("blog_subscriptions", sa.Column("paystack_authorization_code", sa.String(), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("paystack_customer_email", sa.String(), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("pending_plan", sa.String(), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("pending_interval", sa.String(), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("pending_change_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("current_period_started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("blog_subscriptions", "current_period_started_at")
    op.drop_column("blog_subscriptions", "pending_change_at")
    op.drop_column("blog_subscriptions", "pending_interval")
    op.drop_column("blog_subscriptions", "pending_plan")
    op.drop_column("blog_subscriptions", "paystack_customer_email")
    op.drop_column("blog_subscriptions", "paystack_authorization_code")
