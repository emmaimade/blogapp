"""Add is_active field to user table

Revision ID: a1b2c3d4e5f6
Revises: 30ad0a2c60b0
Create Date: 2026-05-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "30ad0a2c60b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add is_active column to user table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check if column already exists
    try:
        columns = {col["name"]: col for col in inspector.get_columns("user")}
        if "is_active" in columns:
            return
    except Exception:
        pass
    
    # Add the column with a default value
    op.add_column(
        "user",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.literal(True))
    )


def downgrade() -> None:
    """Downgrade schema - remove is_active column from user table."""
    op.drop_column("user", "is_active")
