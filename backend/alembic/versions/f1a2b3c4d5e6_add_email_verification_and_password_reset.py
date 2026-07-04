"""add email verification and password reset support

Revision ID: f1a2b3c4d5e6
Revises: 30ad0a2c60b0
Create Date: 2026-07-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "3275a571cbfa"
brach_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {col["name"] for col in inspector.get_columns("user")}

    if "email_verified" not in user_columns:
        op.add_column("user", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "deleted_at" not in user_columns:
        op.add_column("user", sa.Column("deleted_at", sa.DateTime(), nullable=True))

    tables = set(inspector.get_table_names())
    if "email_verifications" not in tables:
        op.create_table(
        "email_verifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_verifications_token"), "email_verifications", ["token"], unique=True)

    if "password_reset_tokens" not in tables:
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_password_reset_tokens_token"), "password_reset_tokens", ["token"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "password_reset_tokens" in tables:
        op.drop_index(op.f("ix_password_reset_tokens_token"), table_name="password_reset_tokens")
        op.drop_table("password_reset_tokens")
    if "email_verifications" in tables:
        op.drop_index(op.f("ix_email_verifications_token"), table_name="email_verifications")
        op.drop_table("email_verifications")

    user_columns = {col["name"] for col in inspector.get_columns("user")}
    if "deleted_at" in user_columns:
        op.drop_column("user", "deleted_at")
    if "email_verified" in user_columns:
        op.drop_column("user", "email_verified")
