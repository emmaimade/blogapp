"""Add platform settings table

Revision ID: b7f2c1d9e4a8
Revises: a1b2c3d4e5f6
Create Date: 2026-05-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "b7f2c1d9e4a8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_tables = set(inspector.get_table_names())
    if "platform_settings" not in existing_tables:
        op.create_table(
            "platform_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("setting_key", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("setting_value", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("setting_key"),
        )

    existing_indexes = {
        index["name"]
        for index in inspector.get_indexes("platform_settings")
    } if "platform_settings" in inspector.get_table_names() else set()

    index_name = op.f("ix_platform_settings_setting_key")
    if index_name not in existing_indexes:
        op.create_index(index_name, "platform_settings", ["setting_key"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "platform_settings" not in existing_tables:
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("platform_settings")}
    index_name = op.f("ix_platform_settings_setting_key")
    if index_name in existing_indexes:
        op.drop_index(index_name, table_name="platform_settings")

    op.drop_table("platform_settings")
