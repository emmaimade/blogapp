"""add must_change_password to user

Revision ID: ad878fe1a78e
Revises: e04a9dd2eabb
Create Date: 2026-07-10 13:49:02.806842

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad878fe1a78e'
down_revision: Union[str, Sequence[str], None] = 'e04a9dd2eabb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user',
        sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('user', 'must_change_password')