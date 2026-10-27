"""add sidebar sponsor placement

Adds SIDEBAR to sponsorplacement: sponsors in a post's right-hand column
(a one-line strip under the title on phones).

IF NOT EXISTS because a copy of a3c9e5f1d7b4 that already listed SIDEBAR was
briefly committed and may have been applied somewhere; this works either way.

Revision ID: b8d4f2a6e9c1
Revises: a3c9e5f1d7b4
Create Date: 2026-10-27 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "b8d4f2a6e9c1"
down_revision = "a3c9e5f1d7b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres only: SQLite stores the column as plain text. ADD VALUE runs
    # outside the migration's transaction, which older Postgres requires.
    if op.get_bind().dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE sponsorplacement ADD VALUE IF NOT EXISTS 'SIDEBAR'")


def downgrade() -> None:
    # Postgres can't drop a value from an enum type. Any sidebar sponsors
    # would have to be moved first, and the type rebuilt by hand.
    pass
