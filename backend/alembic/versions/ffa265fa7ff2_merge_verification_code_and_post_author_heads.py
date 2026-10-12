"""merge verification code and post author heads

a4c8e2f6b1d3 (fix/onboarding-ux) and d2f6a8c4e1b7 (feat/general-purpose-posts)
were written in parallel off a4d7e2c9f1b3. A merge rather than re-chaining one
after the other, because databases already at a4c8e2f6b1d3 would then treat
d2f6a8c4e1b7 as applied and skip it. No schema changes.

Revision ID: ffa265fa7ff2
Revises: a4c8e2f6b1d3, d2f6a8c4e1b7
Create Date: 2026-10-12 23:47:20.445683

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ffa265fa7ff2'
down_revision: Union[str, Sequence[str], None] = ('a4c8e2f6b1d3', 'd2f6a8c4e1b7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
