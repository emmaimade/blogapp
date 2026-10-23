"""
View stats: counting reads from the public blog, and reporting them back to
the workspace in the studio.

A view is recorded by the blog frontend calling the view endpoint once per
post per browser session, not by reading the post — so the team previewing
their own posts, page refreshes and cached navigations don't skew the count.
"""
import csv
import io
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy import func, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, NotFoundError
from app.core.permissions import Permissions
from app.core.plans import get_blog_limits
from app.models import Blog, BlogFollower, BlogRole, BlogSourceDaily, BlogVisitorDaily, Post, PostViewDaily, User
from app.models.post import PostStatus
from app.schemas import (
    AnalyticsDay,
    AnalyticsFollowerPost,
    AnalyticsOverviewDay,
    AnalyticsOverviewRead,
    AnalyticsPostRow,
    AnalyticsPostSort,
    AnalyticsSource,
    AnalyticsTopPost,
    AnalyticsTotals,
    BlogAnalyticsRead,
    StatsRange,
)
from .sources import classify_referrer

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
    referrer: Optional[str] = None,
) -> None:
    """
    Count one read of a published post. Silently ignores crawlers and the
    workspace's own team, who are previewing rather than reading.

    `referrer` comes only with the first view of a visit ("" for none), and
    counts that visit against its source.
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
    if referrer is not None:
        blog = session.get(Blog, blog_id)
        own_hosts = [f"{blog.subdomain}.{settings.PUBLIC_BLOG_BASE_DOMAIN}", blog.custom_domain]
        _increment(
            session, BlogSourceDaily,
            {"blog_id": blog_id, "day": today, "source": classify_referrer(referrer, own_hosts)},
            ["blog_id", "day", "source"], "visits",
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


def _check_history(blog: Blog, stats_range: StatsRange, current_user: User, session: Session) -> Optional[int]:
    """
    The plan's history window in days (None for superadmins), refusing a
    range that reaches further back than it.
    """
    if Permissions.is_super_admin(current_user):
        return None
    history_days = get_blog_limits(session, blog.id).stats_history_days
    if RANGE_DAYS[stats_range] > history_days:
        raise AuthorizationError(
            ErrorCode.PLAN_UPGRADE_REQUIRED,
            f"Your plan includes {history_days} days of view stats. Upgrade to see further back.",
        )
    return history_days


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

    history_days = _check_history(blog, stats_range, current_user, session)

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


# ── The studio's Analytics page (owners and editors) ─────────────────────────

FOLLOWER_POSTS_LIMIT = 5


def _months_back(day: date, months: int) -> date:
    """The 1st of the month `months` before `day`'s month."""
    index = day.year * 12 + day.month - 1 - months
    return date(index // 12, index % 12 + 1, 1)


def _previous_start(stats_range: StatsRange, start: date) -> date:
    """Where the period just before the range starts: the same length back."""
    if stats_range == "12m":
        return _months_back(start, 12)
    return start - timedelta(days=RANGE_DAYS[stats_range])


def _day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


def _daily_counts(session: Session, blog_id: int, start: date, end: date) -> dict[str, dict[date, int]]:
    """Views, visitors, new followers (by confirmation) and unsubscribes per day, start..end inclusive."""
    views = dict(session.exec(
        select(PostViewDaily.day, func.sum(PostViewDaily.views))
        .where(PostViewDaily.blog_id == blog_id, PostViewDaily.day >= start, PostViewDaily.day <= end)
        .group_by(PostViewDaily.day)
    ).all())
    visitors = dict(session.exec(
        select(BlogVisitorDaily.day, BlogVisitorDaily.visitors)
        .where(BlogVisitorDaily.blog_id == blog_id, BlogVisitorDaily.day >= start, BlogVisitorDaily.day <= end)
    ).all())

    # Follower events are timestamps, bucketed here rather than with a SQL
    # date() whose time zone depends on the database.
    window_start, window_end = _day_start(start), _day_start(end + timedelta(days=1))

    def per_day(column) -> dict[date, int]:
        counts: dict[date, int] = {}
        for moment in session.exec(
            select(column).where(BlogFollower.blog_id == blog_id, column >= window_start, column < window_end)
        ).all():
            day = as_utc(moment).date()
            counts[day] = counts.get(day, 0) + 1
        return counts

    return {
        "views": views,
        "visitors": visitors,
        "new_followers": per_day(BlogFollower.confirmed_at),
        "unsubscribes": per_day(BlogFollower.unsubscribed_at),
    }


def _totals(counts: dict[str, dict[date, int]]) -> AnalyticsTotals:
    return AnalyticsTotals(**{metric: sum(by_day.values()) for metric, by_day in counts.items()})


def get_analytics_overview(
    blog: Blog,
    stats_range: StatsRange,
    current_user: User,
    session: Session,
) -> AnalyticsOverviewRead:
    history_days = _check_history(blog, stats_range, current_user, session)
    today = utc_now().date()
    start = _range_start(stats_range, today)

    counts = _daily_counts(session, blog.id, start, today)
    days = [
        AnalyticsOverviewDay(day=day, **{metric: by_day.get(day, 0) for metric, by_day in counts.items()})
        for day in (start + timedelta(days=offset) for offset in range((today - start).days + 1))
    ]

    # Compared with the period just before, only when the plan's history
    # reaches back that far, so the comparison never shows older data.
    previous_start = _previous_start(stats_range, start)
    previous_totals = None
    if history_days is None or (today - previous_start).days + 1 <= history_days:
        previous_totals = _totals(_daily_counts(session, blog.id, previous_start, start - timedelta(days=1)))

    visits = func.sum(BlogSourceDaily.visits)
    sources = [
        AnalyticsSource(source=source, visits=count)
        for source, count in session.exec(
            select(BlogSourceDaily.source, visits)
            .where(BlogSourceDaily.blog_id == blog.id, BlogSourceDaily.day >= start)
            .group_by(BlogSourceDaily.source)
            .order_by(visits.desc(), BlogSourceDaily.source)
        ).all()
    ]

    gained = func.count(BlogFollower.id)
    follower_posts = [
        AnalyticsFollowerPost(id=post_id, title=title, slug=slug, followers=count)
        for post_id, title, slug, count in session.exec(
            select(Post.id, Post.title, Post.slug, gained)
            .select_from(BlogFollower)
            .join(Post, Post.id == BlogFollower.source_post_id)
            .where(BlogFollower.blog_id == blog.id, BlogFollower.confirmed_at >= _day_start(start))
            .group_by(Post.id, Post.title, Post.slug)
            .order_by(gained.desc(), Post.id)
            .limit(FOLLOWER_POSTS_LIMIT)
        ).all()
    ]

    can_export = Permissions.is_super_admin(current_user) or get_blog_limits(session, blog.id).can_export_analytics
    return AnalyticsOverviewRead(
        range=stats_range,
        days=days,
        totals=_totals(counts),
        previous_totals=previous_totals,
        sources=sources,
        follower_posts=follower_posts,
        history_days=history_days,
        can_export=can_export,
    )


def list_post_analytics(
    blog: Blog,
    stats_range: StatsRange,
    sort: AnalyticsPostSort,
    skip: int,
    limit: int,
    current_user: User,
    session: Session,
) -> tuple[list[AnalyticsPostRow], int]:
    """Every published post with its views and followers gained in the range, and lifetime views."""
    _check_history(blog, stats_range, current_user, session)
    start = _range_start(stats_range, utc_now().date())

    views = (
        select(PostViewDaily.post_id, func.sum(PostViewDaily.views).label("views"))
        .where(PostViewDaily.blog_id == blog.id, PostViewDaily.day >= start)
        .group_by(PostViewDaily.post_id)
        .subquery()
    )
    followers = (
        select(BlogFollower.source_post_id.label("post_id"), func.count(BlogFollower.id).label("followers"))
        .where(BlogFollower.blog_id == blog.id, BlogFollower.confirmed_at >= _day_start(start))
        .group_by(BlogFollower.source_post_id)
        .subquery()
    )
    views_in_range = func.coalesce(views.c.views, 0)
    followers_gained = func.coalesce(followers.c.followers, 0)
    statement = (
        select(Post.id, Post.title, Post.slug, Post.published_at, views_in_range, Post.views, followers_gained)
        .outerjoin(views, views.c.post_id == Post.id)
        .outerjoin(followers, followers.c.post_id == Post.id)
        .where(Post.blog_id == blog.id, Post.status == PostStatus.PUBLISHED, Post.is_sample == False)  # noqa: E712
    )
    order = {
        "views": (views_in_range.desc(), Post.published_at.desc()),
        "followers": (followers_gained.desc(), views_in_range.desc()),
        "newest": (Post.published_at.desc(),),
    }[sort]

    total = session.exec(select(func.count()).select_from(statement.subquery())).one()
    rows = [
        AnalyticsPostRow(
            id=post_id, title=title, slug=slug, published_at=published_at,
            views_in_range=in_range, lifetime_views=lifetime, followers_gained=gained_count,
        )
        for post_id, title, slug, published_at, in_range, lifetime, gained_count in session.exec(
            statement.order_by(*order, Post.id.desc()).offset(skip).limit(limit)
        ).all()
    ]
    return rows, total


def export_analytics_csv(
    blog: Blog,
    stats_range: StatsRange,
    current_user: User,
    request: Optional[Request],
    session: Session,
) -> str:
    """Daily rows for the range as CSV. Pro and Team plans."""
    if not Permissions.is_super_admin(current_user) and not get_blog_limits(session, blog.id).can_export_analytics:
        raise AuthorizationError(
            ErrorCode.PLAN_UPGRADE_REQUIRED,
            "Exporting analytics is available on the Pro and Team plans.",
        )
    overview_days = get_analytics_overview(blog, stats_range, current_user, session).days

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["date", "views", "visitors", "new_followers", "unsubscribes"])
    for day in overview_days:
        writer.writerow([day.day.isoformat(), day.views, day.visitors, day.new_followers, day.unsubscribes])

    add_audit_log(
        session,
        action="analytics.export",
        resource_type="blog",
        resource_id=blog.id,
        blog_id=blog.id,
        actor=current_user,
        details={"range": stats_range, "rows": len(overview_days)},
        request=request,
    )
    session.commit()
    return buffer.getvalue()
