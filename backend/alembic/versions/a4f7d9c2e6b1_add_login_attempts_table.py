"""add login attempts table

Revision ID: a4f7d9c2e6b1
Revises: db43f61e3395
Create Date: 2026-09-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a4f7d9c2e6b1"
down_revision = "db43f61e3395"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "login_attempts" not in tables:
        op.create_table(
            "login_attempts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("identifier", sa.String(), nullable=False),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_login_attempts_identifier"), "login_attempts", ["identifier"], unique=False
        )
        op.create_index(
            op.f("ix_login_attempts_ip_address"), "login_attempts", ["ip_address"], unique=False
        )
        op.create_index(
            "ix_login_attempts_identifier_created_at", "login_attempts", ["identifier", "created_at"], unique=False
        )
        op.create_index(
            "ix_login_attempts_ip_address_created_at", "login_attempts", ["ip_address", "created_at"], unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "login_attempts" in tables:
        op.drop_index("ix_login_attempts_ip_address_created_at", table_name="login_attempts")
        op.drop_index("ix_login_attempts_identifier_created_at", table_name="login_attempts")
        op.drop_index(op.f("ix_login_attempts_ip_address"), table_name="login_attempts")
        op.drop_index(op.f("ix_login_attempts_identifier"), table_name="login_attempts")
        op.drop_table("login_attempts")
