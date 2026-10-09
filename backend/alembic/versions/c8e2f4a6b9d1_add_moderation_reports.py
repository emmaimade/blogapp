"""add moderation reports

Re-flagging used to overwrite the pending item's reason and notes, whoever
sent it, and nothing stopped one person reporting the same thing repeatedly.
`moderation_reports` records each person's report once (unique per item and
reporter), and `moderation_items.report_count` counts them. The item keeps
the first report's reason.

Data: each existing moderation item gets one report row from its
reported_by_id / reason / notes / created_at, and a report_count of 1. Earlier
re-flags overwrote each other, so they can't be recovered as separate reports.

Revision ID: c8e2f4a6b9d1
Revises: b4d1e7c9a2f5
Create Date: 2026-10-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c8e2f4a6b9d1"
down_revision = "b4d1e7c9a2f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "moderation_items",
        sa.Column("report_count", sa.Integer(), nullable=False, server_default="1"),
    )

    op.create_table(
        "moderation_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "moderation_item_id",
            sa.Integer(),
            sa.ForeignKey("moderation_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("moderation_item_id", "reporter_id", name="uq_moderation_reports_item_reporter"),
    )
    op.create_index("ix_moderation_reports_moderation_item_id", "moderation_reports", ["moderation_item_id"])
    op.create_index("ix_moderation_reports_reporter_id", "moderation_reports", ["reporter_id"])
    op.create_index("ix_moderation_reports_created_at", "moderation_reports", ["created_at"])

    op.execute(
        "INSERT INTO moderation_reports (moderation_item_id, reporter_id, reason, notes, created_at) "
        "SELECT id, reported_by_id, reason, notes, created_at FROM moderation_items"
    )


def downgrade() -> None:
    op.drop_index("ix_moderation_reports_created_at", table_name="moderation_reports")
    op.drop_index("ix_moderation_reports_reporter_id", table_name="moderation_reports")
    op.drop_index("ix_moderation_reports_moderation_item_id", table_name="moderation_reports")
    op.drop_table("moderation_reports")
    op.drop_column("moderation_items", "report_count")
