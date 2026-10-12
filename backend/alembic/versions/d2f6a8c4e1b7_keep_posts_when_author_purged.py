"""keep posts when their author's account is purged

post.author_id should be ON DELETE SET NULL: a post belongs to its workspace,
so erasing the author's account must not erase their posts in workspaces
other people own. Migration c8d4b0a0d1e1 only created the constraint when it
was missing, so a database whose constraint predates it may still CASCADE.

Inspects the live constraint and recreates it only if it isn't SET NULL, so
running it against an already-correct database changes nothing.

Revision ID: d2f6a8c4e1b7
Revises: a4d7e2c9f1b3
Create Date: 2026-10-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d2f6a8c4e1b7"
down_revision = "a4d7e2c9f1b3"
branch_labels = None
depends_on = None

FK_NAME = "fk_post_author_id_user"


def _author_fk():
    inspector = sa.inspect(op.get_bind())
    for fk in inspector.get_foreign_keys("post"):
        if fk.get("referred_table") == "user" and fk.get("constrained_columns") == ["author_id"]:
            return fk
    return None


def _set_author_fk(ondelete: str) -> None:
    fk = _author_fk()
    current = ((fk or {}).get("options") or {}).get("ondelete")
    if fk and (current or "").upper() == ondelete:
        return
    if fk:
        op.drop_constraint(fk["name"], "post", type_="foreignkey")
    op.create_foreign_key(FK_NAME, "post", "user", ["author_id"], ["id"], ondelete=ondelete)


def upgrade() -> None:
    _set_author_fk("SET NULL")


def downgrade() -> None:
    _set_author_fk("CASCADE")
