"""add_blog_onboarding_fields

Revision ID: d4e8f1a2b3c4
Revises: c9a1f4e7b2d6
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel


revision: str = "d4e8f1a2b3c4"
down_revision: Union[str, Sequence[str], None] = "c9a1f4e7b2d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


onboarding_status = postgresql.ENUM(
    "NOT_STARTED",
    "IN_PROGRESS",
    "COMPLETED",
    name="onboardingstatus",
    create_type=False,
)
onboarding_step = postgresql.ENUM(
    "ABOUT",
    "PROFILE",
    "PUBLICATION",
    "TEAM",
    "PLAN",
    name="onboardingstep",
    create_type=False,
)
workspace_owner_role = postgresql.ENUM(
    "BLOGGER",
    "AGENCY",
    "SAAS_COMPANY",
    "CONTENT_TEAM",
    name="workspaceownerrole",
    create_type=False,
)
workspace_type = postgresql.ENUM(
    "PERSONAL_BLOG",
    "CLIENT_BLOGS",
    "COMPANY_BLOG",
    "DEVELOPER_DOCS",
    name="workspacetype",
    create_type=False,
)
team_size = postgresql.ENUM(
    "SOLO",
    "SMALL",
    "GROWING",
    "LARGE",
    name="teamsize",
    create_type=False,
)
post_visibility = postgresql.ENUM(
    "PUBLIC",
    "MEMBERS_ONLY",
    "PAID_ONLY",
    name="postvisibility",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    onboarding_status.create(bind, checkfirst=True)
    onboarding_step.create(bind, checkfirst=True)
    workspace_owner_role.create(bind, checkfirst=True)
    workspace_type.create(bind, checkfirst=True)
    team_size.create(bind, checkfirst=True)
    post_visibility.create(bind, checkfirst=True)

    op.add_column(
        "blog",
        sa.Column(
            "onboarding_status",
            onboarding_status,
            server_default="COMPLETED",
            nullable=False,
        ),
    )
    op.add_column(
        "blog",
        sa.Column(
            "onboarding_step",
            onboarding_step,
            server_default="PLAN",
            nullable=False,
        ),
    )
    op.add_column("blog", sa.Column("onboarding_completed_at", sa.DateTime(), nullable=True))
    op.add_column("blog", sa.Column("owner_role", workspace_owner_role, nullable=True))
    op.add_column("blog", sa.Column("workspace_type", workspace_type, nullable=True))
    op.add_column("blog", sa.Column("team_size", team_size, nullable=True))
    op.add_column("blog", sa.Column("category", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column(
        "blog",
        sa.Column("primary_language", sqlmodel.sql.sqltypes.AutoString(), server_default="en", nullable=False),
    )
    op.add_column("blog", sa.Column("tagline", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column("blog", sa.Column("logo_url", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column("blog", sa.Column("favicon_url", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column(
        "blog",
        sa.Column(
            "default_post_visibility",
            post_visibility,
            server_default="PUBLIC",
            nullable=False,
        ),
    )
    op.add_column(
        "blog",
        sa.Column("comments_enabled", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "blog",
        sa.Column("posts_per_page", sa.Integer(), server_default="10", nullable=False),
    )
    op.add_column(
        "blog",
        sa.Column("timezone", sqlmodel.sql.sqltypes.AutoString(), server_default="UTC", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("blog", "timezone")
    op.drop_column("blog", "posts_per_page")
    op.drop_column("blog", "comments_enabled")
    op.drop_column("blog", "default_post_visibility")
    op.drop_column("blog", "favicon_url")
    op.drop_column("blog", "logo_url")
    op.drop_column("blog", "tagline")
    op.drop_column("blog", "primary_language")
    op.drop_column("blog", "category")
    op.drop_column("blog", "team_size")
    op.drop_column("blog", "workspace_type")
    op.drop_column("blog", "owner_role")
    op.drop_column("blog", "onboarding_completed_at")
    op.drop_column("blog", "onboarding_step")
    op.drop_column("blog", "onboarding_status")

    bind = op.get_bind()
    post_visibility.drop(bind, checkfirst=True)
    team_size.drop(bind, checkfirst=True)
    workspace_type.drop(bind, checkfirst=True)
    workspace_owner_role.drop(bind, checkfirst=True)
    onboarding_step.drop(bind, checkfirst=True)
    onboarding_status.drop(bind, checkfirst=True)
