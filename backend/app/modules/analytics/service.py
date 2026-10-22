"""
View stats: counting reads from the public blog, and reporting them back to
the workspace in the studio.

A view is recorded by the blog frontend calling the view endpoint once per
post per browser session, not by reading the post — so the team previewing
their own posts, page refreshes and cached navigations don't skew the count.
"""
import re
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session, select

from app.core.datetimes import utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, NotFoundError
from app.core.permissions import Permissions
from app.core.plans import get_blog_limits
from app.models import Blog, BlogRole, BlogVisitorDaily, Post, PostViewDaily, User
from app.models.post import PostStatus
from app.schemas import AnalyticsDay, AnalyticsTopPost, BlogAnalyticsRead, StatsRange

RANGE_DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90, "12m": 365}

TOP_POSTS_LIMIT = 5

# Crawlers, link-preview fetchers and scripts. Most never run the blog's
# JavaScript anyway; this catches the ones that do, or that call the API.
_NON_READER_AGENT = re.compile(
    r"bot|crawl|spider|slurp|preview|facebookexternalhit|headless|curl|wget|python|httpclient|okhttp",
    re.IGNORECASE,
)


def is_non_reader_agent(user_agent: Optional[str]) -> bool:
    return not user_agent or bool(_NON_READER_AGENT.search(user_agent))


def _increment(session: Session, model, values: dict, unique_on: list[str], counter: str) -> None:
    """Insert the day's row with the counter at 1, or add 1 to the existing one, in one statement."""
    insert = pg_insert if session.get_bind().dialect.name == "postgresql" else sqlite_insert
    table = model.__table__
    statement = insert(table).values(**values, **{counter: 1}).on_conflict_do_update(
        index_elements=unique_on,
        set_={counter: table.c[counter] + 1},
    )
    session.execute(statement)


# ── Recording ────────────────────────────────────────────────────────────────

def record_view(
    blog_id: int,
    post_id: int,
    new_visitor: bool,
    user_agent: Optional[str],
    current_user: Optional[User],
    session: Session,
) -> None:
    """
    Count one read of a published post. Silently ignores crawlers and the
    workspace's own team, who are previewing rather than reading.
    """
    if is_non_reader_agent(user_agent):
        return
    if current_user and Permissions.get_user_role_in_blog(current_user, blog_id, session):
        return

    post = session.get(Post, post_id)
    if not post or post.blog_id != blog_id or post.status != PostStatus.PUBLISHED:
        raise NotFoundError(ErrorCode.POST_NOT_FOUND)

    today = utc_now().date()
    _increment(
        session, PostViewDaily,
        {"blog_id": blog_id, "post_id": post_id, "day": today}, ["post_id", "day"], "views",
    )
    if new_visitor:
        _increment(
            session, BlogVisitorDaily,
            {"blog_id": blog_id, "day": today}, ["blog_id", "day"], "visitors",
        )
    # The lifetime total behind "popular" sorting. Pins updated_at, as the
    # read path used to: a view isn't an edit.
    session.execute(
        update(Post)
        .where(Post.id == post_id)
        .values(views=Post.views + 1, updated_at=Post.updated_at)
    )
    session.commit()


# ── Reporting ────────────────────────────────────────────────────────────────

def _range_start(stats_range: StatsRange, today: date) -> date:
    """
    First day of the range. 12m starts on the 1st of the month eleven months
    back, so the studio's monthly columns are whole months plus this month so
    far, rather than opening on a few days of a month that looks like a dip.
    """
    if stats_range == "12m":
        months_back = today.month - 1 + today.year * 12 - 11
        return date(months_back // 12, months_back % 12 + 1, 1)
    return today - timedelta(days=RANGE_DAYS[stats_range] - 1)


def get_blog_analytics(
    blog: Blog,
    stats_range: StatsRange,
    current_user: User,
    session: Session,
) -> BlogAnalyticsRead:
    """
    Daily views and visitors over the range, and the most-read posts in it.
    Authors see only their own posts' views; visitors are blog-wide, so they
    aren't shown to authors.
    """
    role = Permissions.get_user_role_in_blog(current_user, blog.id, session)
    if not role:
        raise AuthorizationError(ErrorCode.NOT_A_MEMBER)

    days = RANGE_DAYS[stats_range]
    history_days = None
    if not Permissions.is_super_admin(current_user):
        history_days = get_blog_limits(session, blog.id).stats_history_days
        if days > history_days:
            raise AuthorizationError(
                ErrorCode.PLAN_UPGRADE_REQUIRED,
                f"Your plan includes {history_days} days of view stats. Upgrade to see further back.",
            )

    today = utc_now().date()
    start = _range_start(stats_range, today)
    days = (today - start).days + 1

    view_scope = [PostViewDaily.blog_id == blog.id, PostViewDaily.day >= start]
    if role == BlogRole.AUTHOR:
        view_scope.append(Post.author_id == current_user.id)

    views_by_day: dict[date, int] = dict(
        session.exec(
            select(PostViewDaily.day, func.sum(PostViewDaily.views))
            .join(Post, Post.id == PostViewDaily.post_id)
            .where(*view_scope)
            .group_by(PostViewDaily.day)
        ).all()
    )

    show_visitors = role != BlogRole.AUTHOR
    visitors_by_day: dict[date, int] = {}
    if show_visitors:
        visitors_by_day = dict(
            session.exec(
                select(BlogVisitorDaily.day, BlogVisitorDaily.visitors).where(
                    BlogVisitorDaily.blog_id == blog.id,
                    BlogVisitorDaily.day >= start,
                )
            ).all()
        )

    series = [
        AnalyticsDay(
            day=day,
            views=views_by_day.get(day, 0),
            visitors=visitors_by_day.get(day, 0) if show_visitors else None,
        )
        for day in (start + timedelta(days=offset) for offset in range(days))
    ]

    period_views = func.sum(PostViewDaily.views)
    top_posts = [
        AnalyticsTopPost(id=post_id, title=title, slug=slug, views=views)
        for post_id, title, slug, views in session.exec(
            select(Post.id, Post.title, Post.slug, period_views)
            .select_from(PostViewDaily)
            .join(Post, Post.id == PostViewDaily.post_id)
            .where(*view_scope)
            .group_by(Post.id, Post.title, Post.slug)
            .order_by(period_views.desc(), Post.id)
            .limit(TOP_POSTS_LIMIT)
        ).all()
    ]

    return BlogAnalyticsRead(
        range=stats_range,
        days=series,
        total_views=sum(day.views for day in series),
        total_visitors=sum(visitors_by_day.values()) if show_visitors else None,
        top_posts=top_posts,
        history_days=history_days,
    )
