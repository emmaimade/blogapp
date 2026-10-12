"""
Background scheduler that promotes scheduled posts to published
when their published_at time has passed, and clears soft-deleted users.

"""
import logging
import os
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger  # Imported for daily schedule
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.config import settings
from app.core.db import engine
from app.core.notifications import add_notification
from app.models import Post
from app.models.post import PostStatus
# Import your task logic directly here
from app.core.tasks import purge_expired_soft_deleted_users

logger = logging.getLogger(__name__)
_scheduler = AsyncIOScheduler()


def publish_scheduled_posts() -> None:
    """
    Find all posts where status=scheduled AND published_at <= now (UTC).
    Promote each one to published=True, status=published.
    Runs every 60 seconds.
    """
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        due_posts = session.exec(
            select(Post).where(
                Post.status == PostStatus.SCHEDULED,
                Post.published_at <= now,
            )
        ).all()

        if not due_posts:
            return

        logger.info(f"[scheduler] Publishing {len(due_posts)} scheduled post(s).")

        for post in due_posts:
            post.status    = PostStatus.PUBLISHED
            post.published = True
            session.add(post)

            add_audit_log(
                session,
                action="post.published",
                resource_type="post",
                resource_id=post.id,
                blog_id=post.blog_id,
                actor=None,            # system action — no human actor
                details={
                    "title":        post.title,
                    "scheduled_at": post.published_at.isoformat(),
                    "source":       "scheduler",
                },
            )

            if post.author_id:
                add_notification(
                    session,
                    user_id=post.author_id,
                    blog_id=post.blog_id,
                    type="post_published",
                    title=f'"{post.title}" is now live',
                    body="Your scheduled post has been published.",
                    link=f"/admin/posts/view/{post.id}?blog={post.blog_id}",
                )

        session.commit()
        logger.info(f"[scheduler] Done — {len(due_posts)} post(s) published.")


def _register_purge_jobs(scheduler: AsyncIOScheduler) -> None:
    """
    The deleted-account purge, in-process: nightly at 00:00 UTC plus once at
    startup to catch up on nights the server wasn't up for (jobs aren't
    persisted).

    Off unless PURGE_ON_STARTUP is set, and never on Vercel. Production purges
    through Vercel Cron (vercel.json -> /internal/cron/...); this is for a
    self-hosted server, or for testing the purge locally. Off by default so a
    dev server pointed at a shared database never erases accounts in it.
    """
    if not settings.PURGE_ON_STARTUP or os.environ.get("VERCEL"):
        return
    scheduler.add_job(
        purge_expired_soft_deleted_users,
        trigger=CronTrigger(hour=0, minute=0),
        id="user_retention_purge",
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace if execution loop delays
    )
    scheduler.add_job(
        purge_expired_soft_deleted_users,
        next_run_time=datetime.now(timezone.utc),
        id="user_retention_purge_catchup",
        replace_existing=True,
    )


def send_trial_notices() -> None:
    # Imported here: the billing module imports the app's routers' services,
    # which this low-level module shouldn't load at import time.
    from app.modules.billing.trial_notices import run_trial_notices

    try:
        with Session(engine) as session:
            run = run_trial_notices(session)
        logger.info(f"[scheduler] Trial notices: {run}")
    except Exception:
        logger.exception("[scheduler] Trial notices failed")


def start_scheduler() -> None:
    # 1. Your Existing Job: Run every 60 seconds
    _scheduler.add_job(
        publish_scheduled_posts,
        trigger=IntervalTrigger(seconds=60),
        id="publish_scheduled_posts",
        replace_existing=True,
        misfire_grace_time=30,   # if a run is missed by ≤30s, still run it
    )
    
    _register_purge_jobs(_scheduler)

    # Trial reminders / trial-ended notices. Production runs this from Vercel
    # Cron instead (see vercel.json); running it twice is harmless.
    _scheduler.add_job(
        send_trial_notices,
        trigger=IntervalTrigger(hours=1),
        id="trial_notices",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    _scheduler.start()
    logger.info("[scheduler] Started (post scheduler; account purge %s).", "on" if settings.PURGE_ON_STARTUP else "off")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[scheduler] Post scheduler stopped.")