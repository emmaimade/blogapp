"""
Emailing a post to the blog's followers when it first goes live.

Publishing only queues the post (queue_new_post). The cron job
(/internal/cron/follower-emails, run_follower_emails) sends in batches over
one SMTP connection, keeping a cursor on the post so a big list carries on
across runs, within a time budget per run and a platform-wide daily limit.
"""
import logging
import smtplib
import time
from contextlib import ExitStack
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session, func, select

import app.core.email as email
from app.core.blog_urls import post_public_url
from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.email_templates import get_new_post_template, get_new_post_template_text
from app.core.notifications import add_notification
from app.core.text import plain_excerpt
from app.models import Blog, BlogFollower, FollowerEmailDaily, FollowerEmailStatus, FollowerStatus, Post
from app.models.post import PostStatus
from .service import unsubscribe_token, unsubscribe_url

logger = logging.getLogger(__name__)

# Within one run: stop starting new emails after this long, so the run ends
# well inside a serverless function's time limit.
RUN_TIME_BUDGET_SECONDS = 8.0
# Followers loaded (and the cursor saved) per batch.
BATCH_SIZE = 25
# Queued longer than this before sending starts (say, while sending was
# switched off) and it's skipped: news, not a backlog.
STALE_AFTER = timedelta(days=3)
EXCERPT_LENGTH = 300


# ── Queueing ─────────────────────────────────────────────────────────────────

def queue_new_post(post: Post) -> None:
    """
    Call whenever a post is saved. Queues it the first time it's live; later
    saves of a live post, and unpublish/republish, never queue it again.
    Unticking "email followers" before sending starts cancels it.
    """
    if post.follower_email_status == FollowerEmailStatus.PENDING and not post.notify_followers:
        post.follower_email_status = FollowerEmailStatus.SKIPPED
        return
    if post.status != PostStatus.PUBLISHED or post.follower_email_status != FollowerEmailStatus.NONE:
        return
    post.follower_email_queued_at = utc_now()
    post.follower_email_status = (
        FollowerEmailStatus.PENDING
        if post.notify_followers and not post.is_sample
        else FollowerEmailStatus.SKIPPED
    )


# ── Sending ──────────────────────────────────────────────────────────────────

@dataclass
class FollowerEmailRun:
    sent: int = 0
    failed: int = 0
    posts_finished: int = 0
    posts_skipped: int = 0
    stopped: Optional[str] = None  # why the run ended early, if it did


def _sent_today(session: Session) -> int:
    row = session.get(FollowerEmailDaily, utc_now().date())
    return row.sent if row else 0


def _count_sent_today(session: Session, count: int) -> None:
    if not count:
        return
    insert = pg_insert if session.get_bind().dialect.name == "postgresql" else sqlite_insert
    table = FollowerEmailDaily.__table__
    session.execute(
        insert(table).values(day=utc_now().date(), sent=count).on_conflict_do_update(
            index_elements=["day"], set_={"sent": table.c.sent + count},
        )
    )


def _message(blog: Blog, post: Post, follower: BlogFollower):
    post_url = post_public_url(blog, post.slug)
    excerpt = plain_excerpt(post.content, EXCERPT_LENGTH)
    leave_url = unsubscribe_url(follower.id)
    headers = {"List-Unsubscribe": f"<{leave_url}>"}
    if settings.PUBLIC_API_URL:
        # One-click unsubscribe (RFC 8058), which Gmail and Yahoo look for.
        one_click = f"{settings.PUBLIC_API_URL.rstrip('/')}/followers/unsubscribe/one-click?token={unsubscribe_token(follower.id)}"
        headers = {"List-Unsubscribe": f"<{one_click}>, <{leave_url}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}
    return email.build_message(
        follower.email,
        post.title,
        get_new_post_template(blog.name, post.title, excerpt, post_url, leave_url, post.thumbnail_url),
        get_new_post_template_text(blog.name, post.title, excerpt, post_url, leave_url),
        from_name=f"{blog.name} via Inko",
        headers=headers,
    )


def _finish(session: Session, post: Post) -> None:
    post.follower_email_status = FollowerEmailStatus.SENT
    session.add(post)
    if post.author_id:
        count = post.follower_emails_sent
        add_notification(
            session,
            user_id=post.author_id,
            blog_id=post.blog_id,
            type="post_emailed",
            title=f'"{post.title}" was emailed to {count} follower{"" if count == 1 else "s"}',
            body="New-post emails to the blog's followers are done.",
            link=f"/admin/posts/view/{post.id}?blog={post.blog_id}",
        )


def run_follower_emails(session: Session) -> FollowerEmailRun:
    """One cron run: send what fits in the time budget and the day's remaining allowance."""
    run = FollowerEmailRun()
    if not settings.FOLLOWER_EMAILS_ENABLED:
        run.stopped = "disabled"
        return run

    started = time.monotonic()
    allowance = settings.FOLLOWER_EMAILS_DAILY_LIMIT - _sent_today(session)
    queue = session.exec(
        select(Post)
        .where(Post.follower_email_status.in_([FollowerEmailStatus.PENDING, FollowerEmailStatus.SENDING]))
        .order_by(Post.follower_email_queued_at, Post.id)
    ).all()

    with ExitStack() as stack:
        server = None
        for post in queue:
            queued_at = as_utc(post.follower_email_queued_at)
            if post.follower_email_status == FollowerEmailStatus.PENDING and (
                queued_at is None or utc_now() - queued_at > STALE_AFTER
            ):
                post.follower_email_status = FollowerEmailStatus.SKIPPED
                session.add(post)
                session.commit()
                run.posts_skipped += 1
                continue

            blog = session.get(Blog, post.blog_id)
            while True:
                if allowance <= 0:
                    run.stopped = "daily limit"
                    return run
                if time.monotonic() - started > RUN_TIME_BUDGET_SECONDS:
                    run.stopped = "time budget"
                    return run

                followers = session.exec(
                    select(BlogFollower)
                    .where(
                        BlogFollower.blog_id == post.blog_id,
                        BlogFollower.status == FollowerStatus.ACTIVE,
                        BlogFollower.confirmed_at <= post.follower_email_queued_at,
                        BlogFollower.id > (post.follower_email_cursor or 0),
                    )
                    .order_by(BlogFollower.id)
                    .limit(min(BATCH_SIZE, allowance))
                ).all()
                if not followers:
                    _finish(session, post)
                    session.commit()
                    run.posts_finished += 1
                    break

                if server is None:
                    try:
                        server = stack.enter_context(email.smtp_connection())
                    except (smtplib.SMTPException, OSError):
                        logger.exception("New-post emails: couldn't connect to SMTP")
                        run.stopped = "smtp error"
                        return run

                sent_now, connection_lost = 0, False
                for follower in followers:
                    message = _message(blog, post, follower)
                    try:
                        server.sendmail(settings.EMAILS_FROM_EMAIL, follower.email, message.as_string())
                        sent_now += 1
                    except (smtplib.SMTPRecipientsRefused, smtplib.SMTPDataError):
                        # This address won't take it; the rest of the list still should.
                        logger.warning("New-post email refused for follower %s (post %s)", follower.id, post.id)
                        run.failed += 1
                    except (smtplib.SMTPException, OSError):
                        # The connection itself went. Keep what was sent, so
                        # nobody gets it twice, and pick up here next run.
                        logger.exception("New-post emails: SMTP connection lost")
                        connection_lost = True
                        break
                    post.follower_email_cursor = follower.id

                post.follower_email_status = FollowerEmailStatus.SENDING
                post.follower_emails_sent += sent_now
                session.add(post)
                _count_sent_today(session, sent_now)
                session.commit()
                run.sent += sent_now
                allowance -= sent_now
                if connection_lost:
                    run.stopped = "smtp error"
                    return run
    return run


# ── Status for the studio ────────────────────────────────────────────────────

def recipients_for(session: Session, post: Post) -> int:
    """Followers the post goes to: active, and following since before it went live."""
    if post.follower_email_queued_at is None:
        return 0
    return session.exec(
        select(func.count()).select_from(BlogFollower).where(
            BlogFollower.blog_id == post.blog_id,
            BlogFollower.status == FollowerStatus.ACTIVE,
            BlogFollower.confirmed_at <= post.follower_email_queued_at,
        )
    ).one()
