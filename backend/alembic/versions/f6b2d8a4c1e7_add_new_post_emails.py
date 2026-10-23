"""add new-post emails

Emailing a post to the blog's followers when it first goes live: per-post
send state on post, and follower_email_daily for the platform-wide daily cap.

Posts already live when this runs are marked skipped, so nothing published
before followers could be emailed goes out now.

Revision ID: f6b2d8a4c1e7
Revises: e1a7c3f9b5d2
Create Date: 2026-10-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f6b2d8a4c1e7"
down_revision = "e1a7c3f9b5d2"
branch_labels = None
depends_on = None

# Member names, as SQLModel stores str enums (see the other enum columns).
FOLLOWER_EMAIL_STATUS = sa.Enum("NONE", "PENDING", "SENDING", "SENT", "SKIPPED", name="followeremailstatus")


def upgrade() -> None:
    FOLLOWER_EMAIL_STATUS.create(op.get_bind(), checkfirst=True)
    op.add_column("post", sa.Column("notify_followers", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column(
        "post",
        sa.Column("follower_email_status", FOLLOWER_EMAIL_STATUS, nullable=False, server_default="NONE"),
    )
    op.add_column("post", sa.Column("follower_email_queued_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("post", sa.Column("follower_email_cursor", sa.Integer(), nullable=True))
    op.add_column("post", sa.Column("follower_emails_sent", sa.Integer(), nullable=False, server_default="0"))
    op.execute("UPDATE post SET follower_email_status = 'SKIPPED' WHERE status = 'PUBLISHED'")

    op.create_table(
        "follower_email_daily",
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("sent", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("follower_email_daily")
    op.drop_column("post", "follower_emails_sent")
    op.drop_column("post", "follower_email_cursor")
    op.drop_column("post", "follower_email_queued_at")
    op.drop_column("post", "follower_email_status")
    op.drop_column("post", "notify_followers")
    FOLLOWER_EMAIL_STATUS.drop(op.get_bind(), checkfirst=True)
