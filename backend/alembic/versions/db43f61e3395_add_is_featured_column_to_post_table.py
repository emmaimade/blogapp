"""add is_featured column to post table

Revision ID: db43f61e3395
Revises: 7c1e4f9a2b3d
Create Date: 2026-08-31 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'db43f61e3395'
down_revision: Union[str, Sequence[str], None] = '7c1e4f9a2b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'post',
        sa.Column(
            'is_featured',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false')
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('post', 'is_featured')
