"""Add audit and moderation tables

Revision ID: c9a1f4e7b2d6
Revises: b7f2c1d9e4a8
Create Date: 2026-05-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "c9a1f4e7b2d6"
down_revision: Union[str, Sequence[str], None] = "b7f2c1d9e4a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "audit_logs" not in existing_tables:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("actor_user_id", sa.Integer(), nullable=True),
            sa.Column("actor_email", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("action", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("resource_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("resource_id", sa.Integer(), nullable=True),
            sa.Column("blog_id", sa.Integer(), nullable=True),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("ip_address", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if "moderation_items" not in existing_tables:
        op.create_table(
            "moderation_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("blog_id", sa.Integer(), nullable=False),
            sa.Column("content_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("content_id", sa.Integer(), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("reason", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("snapshot_content", sa.Text(), nullable=False),
            sa.Column("snapshot_author", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("reported_by_id", sa.Integer(), nullable=True),
            sa.Column("resolved_by_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if "moderation_actions" not in existing_tables:
        op.create_table(
            "moderation_actions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("moderation_item_id", sa.Integer(), nullable=False),
            sa.Column("actor_user_id", sa.Integer(), nullable=True),
            sa.Column("action", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    _create_indexes(inspector)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table in ("moderation_actions", "moderation_items", "audit_logs"):
        if table not in existing_tables:
            continue
        for index in inspector.get_indexes(table):
            op.drop_index(index["name"], table_name=table)
        op.drop_table(table)


def _create_indexes(inspector: sa.Inspector) -> None:
    index_map = {
        "audit_logs": [
            ("ix_audit_logs_actor_user_id", ["actor_user_id"]),
            ("ix_audit_logs_actor_email", ["actor_email"]),
            ("ix_audit_logs_action", ["action"]),
            ("ix_audit_logs_resource_type", ["resource_type"]),
            ("ix_audit_logs_resource_id", ["resource_id"]),
            ("ix_audit_logs_blog_id", ["blog_id"]),
            ("ix_audit_logs_created_at", ["created_at"]),
        ],
        "moderation_items": [
            ("ix_moderation_items_blog_id", ["blog_id"]),
            ("ix_moderation_items_content_type", ["content_type"]),
            ("ix_moderation_items_content_id", ["content_id"]),
            ("ix_moderation_items_status", ["status"]),
            ("ix_moderation_items_reported_by_id", ["reported_by_id"]),
            ("ix_moderation_items_resolved_by_id", ["resolved_by_id"]),
            ("ix_moderation_items_created_at", ["created_at"]),
        ],
        "moderation_actions": [
            ("ix_moderation_actions_moderation_item_id", ["moderation_item_id"]),
            ("ix_moderation_actions_actor_user_id", ["actor_user_id"]),
            ("ix_moderation_actions_action", ["action"]),
            ("ix_moderation_actions_created_at", ["created_at"]),
        ],
    }

    for table, indexes in index_map.items():
        existing_indexes = {index["name"] for index in inspector.get_indexes(table)}
        for index_name, columns in indexes:
            if index_name not in existing_indexes:
                op.create_index(index_name, table, columns, unique=False)
