"""
Background scheduler that promotes scheduled posts to published
when their published_at time has passed, and clears soft-deleted users.

"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger  # Imported for daily schedule
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.db import engine
from app.models import Post
from app.models.post import PostStatus
# Import your task logic directly here
from app.modules.superadmin.tasks import purge_expired_soft_deleted_users

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

        session.commit()
        logger.info(f"[scheduler] Done — {len(due_posts)} post(s) published.")


def start_scheduler() -> None:
    # 1. Your Existing Job: Run every 60 seconds
    _scheduler.add_job(
        publish_scheduled_posts,
        trigger=IntervalTrigger(seconds=60),
        id="publish_scheduled_posts",
        replace_existing=True,
        misfire_grace_time=30,   # if a run is missed by ≤30s, still run it
    )
    
    # 2. Your New Automated Job: Runs every night at midnight (UTC)
    _scheduler.add_job(
        purge_expired_soft_deleted_users,
        trigger=CronTrigger(hour=0, minute=0),
        id="user_retention_purge",
        replace_existing=True,
        misfire_grace_time=3600, # 1 hour grace if execution loop delays
    )

    # TIP FOR LOCAL DEV TESTING: Un-comment this line below to see it run every 10 seconds!
    # _scheduler.add_job(purge_expired_soft_deleted_users, trigger=IntervalTrigger(seconds=10), id="test_purge", replace_existing=True)

    _scheduler.start()
    logger.info("[scheduler] Automation tasks started (Post scheduler & User retention purge online).")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[scheduler] Post scheduler stopped.")