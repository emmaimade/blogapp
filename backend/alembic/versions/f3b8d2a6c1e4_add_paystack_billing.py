"""add paystack billing

Moves blog_subscriptions from the unused Stripe columns to Paystack's
identifiers, records trial use and billing interval, and adds the
payment_transactions (billing history) and payment_events (webhook
de-duplication) tables.

Data: until now onboarding granted Pro/Team without payment. Every existing
Pro/Team workspace is moved onto a fresh 14-day trial from the moment this
runs, after which the normal billing rules apply.

Revision ID: f3b8d2a6c1e4
Revises: e5a9c3f1b7d2
Create Date: 2026-10-07 00:00:00.000000

"""
from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f3b8d2a6c1e4"
down_revision = "e5a9c3f1b7d2"
branch_labels = None
depends_on = None

TRIAL_DAYS = 14


def upgrade() -> None:
    op.alter_column("blog_subscriptions", "stripe_customer_id", new_column_name="paystack_customer_code")
    op.alter_column("blog_subscriptions", "stripe_subscription_id", new_column_name="paystack_subscription_code")
    op.add_column("blog_subscriptions", sa.Column("paystack_email_token", sa.String(), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("billing_interval", sa.String(), nullable=True))
    op.add_column("blog_subscriptions", sa.Column("last_payment_reference", sa.String(), nullable=True))
    op.add_column(
        "blog_subscriptions",
        sa.Column("trial_used", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference", sa.String(), nullable=False),
        sa.Column("amount_kobo", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("plan", sa.String(), nullable=False),
        sa.Column("billing_interval", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_transactions_blog_id", "payment_transactions", ["blog_id"])
    op.create_index("ix_payment_transactions_reference", "payment_transactions", ["reference"], unique=True)

    op.create_table(
        "payment_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_key", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blog.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_events_event_key", "payment_events", ["event_key"], unique=True)
    op.create_index("ix_payment_events_event_type", "payment_events", ["event_type"])
    op.create_index("ix_payment_events_blog_id", "payment_events", ["blog_id"])

    # The plan column is a Postgres enum keyed by member name (FREE/PRO/TEAM).
    op.get_bind().execute(
        sa.text(
            "UPDATE blog_subscriptions "
            "SET status = 'trialing', trial_used = true, trial_ends_at = :trial_ends_at "
            "WHERE plan IN ('PRO', 'TEAM')"
        ),
        {"trial_ends_at": datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)},
    )


def downgrade() -> None:
    # The trial backfill isn't reversed: those workspaces keep their plan
    # with status 'trialing', which the pre-billing code ignores.
    op.drop_index("ix_payment_events_blog_id", table_name="payment_events")
    op.drop_index("ix_payment_events_event_type", table_name="payment_events")
    op.drop_index("ix_payment_events_event_key", table_name="payment_events")
    op.drop_table("payment_events")

    op.drop_index("ix_payment_transactions_reference", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_blog_id", table_name="payment_transactions")
    op.drop_table("payment_transactions")

    op.drop_column("blog_subscriptions", "trial_used")
    op.drop_column("blog_subscriptions", "last_payment_reference")
    op.drop_column("blog_subscriptions", "billing_interval")
    op.drop_column("blog_subscriptions", "paystack_email_token")
    op.alter_column("blog_subscriptions", "paystack_subscription_code", new_column_name="stripe_subscription_id")
    op.alter_column("blog_subscriptions", "paystack_customer_code", new_column_name="stripe_customer_id")
