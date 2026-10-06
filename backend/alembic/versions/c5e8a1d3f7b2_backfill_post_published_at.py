"""backfill post published_at

`published_at` was added alongside post status (9d0992361088) without filling
it in for posts that were already live, so those posts have no publish date.
The public blog now shows and sorts by publish date, so this sets it to the
post's creation time — the best record of when a pre-existing post went live.

Only published posts with no published_at are touched; drafts and scheduled
posts keep theirs (a draft has none, a scheduled post has its go-live time).

Revision ID: c5e8a1d3f7b2
Revises: b7c3e1f9a2d4
Create Date: 2026-10-06 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c5e8a1d3f7b2"
down_revision = "b7c3e1f9a2d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # `status` is a native enum stored by member name ('PUBLISHED').
    op.execute(
        """
        UPDATE post
        SET published_at = created_at
        WHERE published_at IS NULL
          AND (published = true OR status = 'PUBLISHED')
        """
    )


def downgrade() -> None:
    # Backfilled values can't be told apart from real publish dates, and
    # clearing them would only lose information — nothing to undo.
    pass
