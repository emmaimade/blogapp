"""add email verification code

Signup now asks for a 6-digit code from the verification email before the
studio opens. The code rides on the same email_verifications row as the link
token: code_hash holds its HMAC, code_attempts counts wrong guesses. Rows made
before this have no code and keep working as links.

Revision ID: a4c8e2f6b1d3
Revises: e1a7c3d5f9b2
Create Date: 2026-10-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a4c8e2f6b1d3"
down_revision = "e1a7c3d5f9b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("email_verifications", sa.Column("code_hash", sa.String(), nullable=True))
    op.add_column(
        "email_verifications",
        sa.Column("code_attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("email_verifications", "code_attempts")
    op.drop_column("email_verifications", "code_hash")
