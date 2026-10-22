"""
Following a blog by email: double opt-in, unsubscribing, and the limits that
keep the follow form from being used to flood someone's inbox.

The follow endpoint answers the same way whether or not an address already
follows, has a pending confirmation, or was throttled — it never tells a
visitor anything about who follows a blog.
"""
import hashlib
import hmac
from datetime import timedelta
from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.datetimes import as_utc, utc_now
from app.core.email import dispatch_email
from app.core.email_templates import get_follow_confirmation_template, get_follow_confirmation_template_text
from app.core.error_codes import ErrorCode
from app.core.exceptions import BadRequestError, GoneError, RateLimitError
from app.core.plans import ensure_follower_capacity
from app.models import Blog, BlogFollower, FollowerStatus, Post
from app.models.post import PostStatus
from app.schemas import FollowCreate
from app.services.auth_tokens import generate_secure_token

CONFIRM_LINK_DAYS = 7

# One address: a confirmation email at most every 10 minutes, 3 a day.
RESEND_GAP = timedelta(minutes=10)
SENDS_PER_DAY = 3
# One blog: at most this many confirmation emails an hour, whoever they go to.
BLOG_SENDS_PER_HOUR = 30

FOLLOW_ACCEPTED_MESSAGE = "Check your inbox for a link to confirm."


# ── Unsubscribe links ────────────────────────────────────────────────────────
# Signed rather than stored: "{follower id}.{signature}". It only ever lets
# someone stop emails to that address, and nothing needs saving per email.

def _unsubscribe_signature(follower_id: int) -> str:
    message = f"unsubscribe:{follower_id}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()[:32]


def unsubscribe_token(follower_id: int) -> str:
    return f"{follower_id}.{_unsubscribe_signature(follower_id)}"


def unsubscribe_url(follower_id: int) -> str:
    return f"{settings.PUBLIC_SITE_URL}/follow/unsubscribe?token={unsubscribe_token(follower_id)}"


def _follower_from_unsubscribe_token(token: str, session: Session) -> Optional[BlogFollower]:
    follower_id, _, signature = token.partition(".")
    if not follower_id.isdigit() or not hmac.compare_digest(signature, _unsubscribe_signature(int(follower_id))):
        return None
    return session.get(BlogFollower, int(follower_id))


# ── Following ────────────────────────────────────────────────────────────────

def _valid_source_post(session: Session, blog_id: int, post_id: Optional[int]) -> Optional[int]:
    if post_id is None:
        return None
    post = session.get(Post, post_id)
    if not post or post.blog_id != blog_id or post.status != PostStatus.PUBLISHED:
        return None
    return post_id


def _check_blog_send_rate(session: Session, blog_id: int) -> None:
    sent_last_hour = session.exec(
        select(func.count()).select_from(BlogFollower).where(
            BlogFollower.blog_id == blog_id,
            BlogFollower.confirm_sent_at >= utc_now() - timedelta(hours=1),
        )
    ).one()
    if sent_last_hour >= BLOG_SENDS_PER_HOUR:
        raise RateLimitError(
            message="This blog is getting a lot of new followers right now. Please try again in a little while.",
        )


def _may_send_to(follower: BlogFollower) -> bool:
    """Whether this address can be sent another confirmation email yet."""
    last_sent = as_utc(follower.confirm_sent_at)
    if last_sent is None:
        return True
    elapsed = utc_now() - last_sent
    if elapsed < RESEND_GAP:
        return False
    return elapsed >= timedelta(days=1) or follower.confirm_send_count < SENDS_PER_DAY


def follow(blog: Blog, payload: FollowCreate, background_tasks: BackgroundTasks, session: Session) -> None:
    """Start (or restart) a follow and email the confirmation link."""
    if payload.website:
        return  # the honeypot was filled in: a bot

    email = payload.email.strip().lower()
    follower = session.exec(
        select(BlogFollower).where(BlogFollower.blog_id == blog.id, BlogFollower.email == email)
    ).first()
    if follower and follower.status == FollowerStatus.ACTIVE:
        return
    if follower and not _may_send_to(follower):
        return

    _check_blog_send_rate(session, blog.id)
    ensure_follower_capacity(session, blog.id)

    now = utc_now()
    raw_token, token_hash = generate_secure_token()
    if follower is None:
        follower = BlogFollower(blog_id=blog.id, email=email, confirm_send_count=0)
    last_sent = as_utc(follower.confirm_sent_at)
    in_same_day = last_sent is not None and now - last_sent < timedelta(days=1)

    follower.status = FollowerStatus.PENDING
    follower.confirm_token_hash = token_hash
    follower.confirm_sent_at = now
    follower.confirm_send_count = follower.confirm_send_count + 1 if in_same_day else 1
    follower.unsubscribed_at = None
    follower.source_post_id = _valid_source_post(session, blog.id, payload.source_post_id) or follower.source_post_id
    session.add(follower)
    try:
        session.commit()
    except IntegrityError:
        # The same address submitted twice at once; the other request sends the email.
        session.rollback()
        return

    confirm_url = f"{settings.PUBLIC_SITE_URL}/follow/confirm?token={raw_token}"
    dispatch_email(
        background_tasks,
        email,
        f"Confirm you want to follow {blog.name}",
        get_follow_confirmation_template(blog.name, confirm_url),
        get_follow_confirmation_template_text(blog.name, confirm_url),
    )


def confirm(token: str, session: Session) -> str:
    """Activate the follow behind an emailed link; returns the blog's name."""
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    follower = session.exec(
        select(BlogFollower).where(BlogFollower.confirm_token_hash == token_hash)
    ).first()
    if follower is None:
        raise BadRequestError(ErrorCode.INVALID_TOKEN)

    blog = session.get(Blog, follower.blog_id)
    if follower.status == FollowerStatus.ACTIVE:
        return blog.name

    sent_at = as_utc(follower.confirm_sent_at)
    if sent_at is None or utc_now() - sent_at > timedelta(days=CONFIRM_LINK_DAYS):
        raise GoneError(ErrorCode.LINK_EXPIRED)

    ensure_follower_capacity(session, follower.blog_id)

    follower.status = FollowerStatus.ACTIVE
    follower.confirmed_at = utc_now()
    session.add(follower)
    session.commit()
    return blog.name


def unsubscribe(token: str, session: Session) -> str:
    """Stop emails to a follower; returns the blog's name. Safe to repeat."""
    follower = _follower_from_unsubscribe_token(token, session)
    if follower is None:
        raise BadRequestError(ErrorCode.INVALID_TOKEN)

    if follower.status != FollowerStatus.UNSUBSCRIBED:
        follower.status = FollowerStatus.UNSUBSCRIBED
        follower.unsubscribed_at = utc_now()
        # An old confirmation link mustn't sign them back up.
        follower.confirm_token_hash = None
        session.add(follower)
        session.commit()
    return session.get(Blog, follower.blog_id).name
