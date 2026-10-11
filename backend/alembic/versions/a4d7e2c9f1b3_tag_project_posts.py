"""tag project posts

"Showcase Project" is gone as a post type: it was a developer-portfolio idea
in a product for every kind of blog. Blogs that used it keep their grouping
as an ordinary "Projects" tag, which the public blog can already filter by.

For each blog with project posts, this reuses that blog's "Projects" tag (any
case) or creates one, and links every project post to it. Posts already
tagged are left alone, so running it twice changes nothing.

`post.is_project` and the `projectmetadata` table stay for now; nothing reads
them any more and a later migration can drop them.

Revision ID: a4d7e2c9f1b3
Revises: e1a7c3d5f9b2
Create Date: 2026-10-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a4d7e2c9f1b3"
down_revision = "e1a7c3d5f9b2"
branch_labels = None
depends_on = None

TAG_NAME = "Projects"


def tag_project_posts(connection) -> int:
    """Links each project post to its blog's "Projects" tag. Returns the
    number of links added."""
    blog_ids = connection.execute(
        sa.text("SELECT DISTINCT blog_id FROM post WHERE is_project = true")
    ).scalars().all()

    added = 0
    for blog_id in blog_ids:
        tag_id = connection.execute(
            sa.text("SELECT id FROM tag WHERE blog_id = :blog_id AND lower(name) = lower(:name) ORDER BY id LIMIT 1"),
            {"blog_id": blog_id, "name": TAG_NAME},
        ).scalar()
        if tag_id is None:
            connection.execute(
                sa.text("INSERT INTO tag (name, blog_id) VALUES (:name, :blog_id)"),
                {"name": TAG_NAME, "blog_id": blog_id},
            )
            tag_id = connection.execute(
                sa.text("SELECT id FROM tag WHERE blog_id = :blog_id AND name = :name ORDER BY id DESC LIMIT 1"),
                {"blog_id": blog_id, "name": TAG_NAME},
            ).scalar()

        result = connection.execute(
            sa.text(
                """
                INSERT INTO posttaglink (post_id, tag_id)
                SELECT p.id, :tag_id FROM post p
                WHERE p.blog_id = :blog_id
                  AND p.is_project = true
                  AND NOT EXISTS (
                    SELECT 1 FROM posttaglink l WHERE l.post_id = p.id AND l.tag_id = :tag_id
                  )
                """
            ),
            {"tag_id": tag_id, "blog_id": blog_id},
        )
        added += result.rowcount or 0
    return added


def upgrade() -> None:
    tag_project_posts(op.get_bind())


def downgrade() -> None:
    # The links can't be told apart from ones the owner added by hand, and
    # removing a tag a reader might have bookmarked only loses information.
    pass
