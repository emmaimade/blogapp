"""Fix post author relationship

Revision ID: c8d4b0a0d1e1
Revises: 35e89cf2f6d2
Create Date: 2026-03-25 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8d4b0a0d1e1"
down_revision: Union[str, Sequence[str], None] = "35e89cf2f6d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("post")}

    if "author_id" not in columns:
        op.add_column("post", sa.Column("author_id", sa.Integer(), nullable=True))
    elif not isinstance(columns["author_id"]["type"], sa.Integer):
        op.execute(
            """
            ALTER TABLE post
            ALTER COLUMN author_id TYPE INTEGER
            USING (
                CASE
                    WHEN author_id IS NULL OR trim(author_id) = '' THEN NULL
                    WHEN trim(author_id) ~ '^[0-9]+$' THEN trim(author_id)::integer
                    ELSE NULL
                END
            )
            """
        )

    inspector = sa.inspect(bind)
    foreign_keys = inspector.get_foreign_keys("post")
    has_author_fk = any(
        fk.get("referred_table") == "user" and fk.get("constrained_columns") == ["author_id"]
        for fk in foreign_keys
    )

    if not has_author_fk:
        op.create_foreign_key(
            "fk_post_author_id_user",
            "post",
            "user",
            ["author_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("post")}
    foreign_keys = inspector.get_foreign_keys("post")

    has_author_fk = any(
        fk.get("name") == "fk_post_author_id_user"
        or (fk.get("referred_table") == "user" and fk.get("constrained_columns") == ["author_id"])
        for fk in foreign_keys
    )

    if has_author_fk:
        op.drop_constraint("fk_post_author_id_user", "post", type_="foreignkey")

    if "author_id" in columns and isinstance(columns["author_id"]["type"], sa.Integer):
        op.alter_column(
            "post",
            "author_id",
            existing_type=sa.Integer(),
            type_=sa.String(),
            existing_nullable=True,
            postgresql_using="author_id::text",
        )
