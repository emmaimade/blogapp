"""add is_sample column to post table

Revision ID: ba9a10a2f3e9
Revises: 328938876b29
Create Date: 2026-06-06 10:25:10.446055
"""

from alembic import op
import sqlalchemy as sa
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'ba9a10a2f3e9'
down_revision: Union[str, Sequence[str], None] = '328938876b29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'post', 
        sa.Column(
            'is_sample', 
            sa.Boolean(), 
            nullable=False, 
            server_default=sa.text('false')
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('post', 'is_sample')