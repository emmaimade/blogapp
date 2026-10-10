"""add comment lifecycle fields and indexes

- Indexes on comment.post_id / parent_id / user_id: every thread read filters
  on post_id and parent_id, and none of them were indexed.
- `edited_at`: when the author last edited the content, so the blog can show
  an "edited" label (`updated_at` also moves on moderation writes).
- `deleted_at` / `deleted_by`: deletion no longer overwrites `content` — the
  original is kept for moderators and public responses show a placeholder.

Data: comments deleted before this ran already had their content replaced by
a placeholder, so their original text is gone. `deleted_by` is backfilled
from which placeholder they carry, and `deleted_at` from `updated_at`.

Revision ID: b4d1e7c9a2f5
Revises: a7c2e9f4b1d3
Create Date: 2026-10-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b4d1e7c9a2f5"
down_revision = "a7c2e9f4b1d3"
branch_labels = None
depends_on = None

# Placeholder text written by each delete path before this migration.
_LEGACY_PLACEHOLDERS = {
    "author": "%deleted by the author%",
    "moderator": "%deleted by a moderator%",
    "platform": "%removed by a moderator%",
}


def upgrade() -> None:
    op.add_column("comment", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("comment", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("comment", sa.Column("deleted_by", sa.String(length=16), nullable=True))

    op.create_index("ix_comment_post_id", "comment", ["post_id"])
    op.create_index("ix_comment_parent_id", "comment", ["parent_id"])
    op.create_index("ix_comment_user_id", "comment", ["user_id"])

    for deleted_by, pattern in _LEGACY_PLACEHOLDERS.items():
        op.execute(
            sa.text(
                "UPDATE comment SET deleted_by = :deleted_by "
                "WHERE is_deleted = :yes AND deleted_by IS NULL AND content LIKE :pattern"
            ).bindparams(deleted_by=deleted_by, yes=True, pattern=pattern)
        )
    op.execute(
        sa.text(
            "UPDATE comment SET deleted_at = updated_at WHERE is_deleted = :yes AND deleted_at IS NULL"
        ).bindparams(yes=True)
    )


def downgrade() -> None:
    # The pre-migration code renders `content` as-is, so deleted comments'
    # retained text would go public again — re-mask it before dropping.
    op.execute(
        sa.text(
            "UPDATE comment SET content = CASE "
            "WHEN deleted_by = 'author' THEN '[This comment has been deleted by the author]' "
            "ELSE '[This comment has been removed by a moderator]' END "
            "WHERE is_deleted = :yes"
        ).bindparams(yes=True)
    )

    op.drop_index("ix_comment_user_id", table_name="comment")
    op.drop_index("ix_comment_parent_id", table_name="comment")
    op.drop_index("ix_comment_post_id", table_name="comment")

    op.drop_column("comment", "deleted_by")
    op.drop_column("comment", "deleted_at")
    op.drop_column("comment", "edited_at")
