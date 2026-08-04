"""make email_verifications and password_reset_tokens timestamps timezone-aware

Revision ID: e04a9dd2eabb
Revises: f1a2b3c4d5e6
Create Date: 2026-07-08 10:41:08.227549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e04a9dd2eabb'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("email_verifications", "password_reset_tokens"):
        for col in ("expires_at", "used_at", "created_at"):
            op.alter_column(
                table, col,
                type_=sa.DateTime(timezone=True),
                postgresql_using=f"{col} AT TIME ZONE 'UTC'",
            )


def downgrade() -> None:
    for table in ("email_verifications", "password_reset_tokens"):
        for col in ("expires_at", "used_at", "created_at"):
            op.alter_column(
                table, col,
                type_=sa.DateTime(timezone=False),
            )