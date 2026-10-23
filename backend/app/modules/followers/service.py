"""
Following a blog by email: double opt-in, unsubscribing, and the limits that
keep the follow form from being used to flood someone's inbox.

The follow endpoint answers the same way whether or not an address already
follows, has a pending confirmation, or was throttled — it never tells a
visitor anything about who follows a blog.
"""
import csv
import hashlib
import hmac
import io
from datetime import timedelta
from typing import Optional

from fastapi import BackgroundTasks, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.core.audit import add_audit_log
from app.core.config import settings
from app.core.csv_export import csv_safe
from app.core.datetimes import as_utc, utc_now
from app.core.email import dispatch_email
from app.core.email_templates import get_follow_confirmation_template, get_follow_confirmation_template_text
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, BadRequestError, GoneError, NotFoundError, RateLimitError
from app.core.permissions import Permissions
from app.core.plans import ensure_follower_capacity, get_blog_limits
from app.models import Blog, BlogFollower, FollowerStatus, Post, User
from app.models.post import PostStatus
from app.schemas import FollowCreate, FollowerRead, FollowerSummary
from app.schemas.followers import FollowerSourcePost
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
    if not blog.followers_enabled:
        raise AuthorizationError(ErrorCode.FOLLOWING_DISABLED)

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


# ── Studio: the Audience page ────────────────────────────────────────────────
# Owners and editors see and manage followers. Exporting the list is the
# owner's, or an editor's they've granted export_followers to.

EXPORT_PERMISSION = "export_followers"


def mask_email(email: str) -> str:
    """'reader@example.com' -> 're***@example.com', for activity log entries."""
    local, _, domain = email.partition("@")
    return f"{local[:2]}***@{domain}"


def follower_summary(blog: Blog, current_user: User, session: Session) -> FollowerSummary:
    counts = dict(
        session.exec(
            select(BlogFollower.status, func.count())
            .where(BlogFollower.blog_id == blog.id)
            .group_by(BlogFollower.status)
        ).all()
    )
    return FollowerSummary(
        active=counts.get(FollowerStatus.ACTIVE, 0),
        pending=counts.get(FollowerStatus.PENDING, 0),
        unsubscribed=counts.get(FollowerStatus.UNSUBSCRIBED, 0),
        max_followers=get_blog_limits(session, blog.id).max_followers,
        followers_enabled=blog.followers_enabled,
        can_export=Permissions.has_member_permission(current_user, blog.id, EXPORT_PERMISSION, session),
    )


def _filtered(blog_id: int, status: Optional[FollowerStatus], q: Optional[str]):
    statement = select(BlogFollower).where(BlogFollower.blog_id == blog_id)
    if status is not None:
        statement = statement.where(BlogFollower.status == status)
    if q and q.strip():
        statement = statement.where(BlogFollower.email.contains(q.strip().lower()))
    return statement


def _to_reads(session: Session, followers: list[BlogFollower]) -> list[FollowerRead]:
    post_ids = {f.source_post_id for f in followers if f.source_post_id}
    posts = {
        post.id: FollowerSourcePost(id=post.id, title=post.title, slug=post.slug)
        for post in (session.exec(select(Post).where(Post.id.in_(post_ids))).all() if post_ids else [])
    }
    return [
        FollowerRead(
            id=f.id,
            email=f.email,
            status=f.status,
            created_at=f.created_at,
            confirmed_at=f.confirmed_at,
            unsubscribed_at=f.unsubscribed_at,
            source_post=posts.get(f.source_post_id),
        )
        for f in followers
    ]


def list_followers(
    blog_id: int,
    status: Optional[FollowerStatus],
    q: Optional[str],
    skip: int,
    limit: int,
    session: Session,
) -> tuple[list[FollowerRead], int]:
    statement = _filtered(blog_id, status, q)
    total = session.exec(select(func.count()).select_from(statement.subquery())).one()
    followers = session.exec(
        statement.order_by(BlogFollower.created_at.desc(), BlogFollower.id.desc()).offset(skip).limit(limit)
    ).all()
    return _to_reads(session, list(followers)), total


def remove_follower(
    blog_id: int,
    follower_id: int,
    current_user: User,
    request: Optional[Request],
    session: Session,
) -> None:
    """
    Delete a follower outright: for junk sign-ups, and for a reader asking for
    their data to be erased. (A reader unsubscribing themselves is kept as
    unsubscribed instead, which the stats count.)
    """
    follower = session.get(BlogFollower, follower_id)
    if not follower or follower.blog_id != blog_id:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND)
    add_audit_log(
        session,
        action="follower.remove",
        resource_type="follower",
        resource_id=follower.id,
        blog_id=blog_id,
        actor=current_user,
        details={"email": mask_email(follower.email), "status": follower.status.value},
        request=request,
    )
    session.delete(follower)
    session.commit()


def export_followers_csv(
    blog: Blog,
    status: Optional[FollowerStatus],
    current_user: User,
    request: Optional[Request],
    session: Session,
) -> str:
    if not Permissions.has_member_permission(current_user, blog.id, EXPORT_PERMISSION, session):
        raise AuthorizationError(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only the workspace owner, or an editor they've allowed, can export followers.",
        )

    followers = session.exec(
        _filtered(blog.id, status, None).order_by(BlogFollower.created_at, BlogFollower.id)
    ).all()
    rows = _to_reads(session, list(followers))

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["email", "status", "followed_utc", "confirmed_utc", "unsubscribed_utc", "source_post"])
    for row in rows:
        writer.writerow([csv_safe(value) for value in (
            row.email,
            row.status.value,
            row.created_at.isoformat(),
            row.confirmed_at.isoformat() if row.confirmed_at else "",
            row.unsubscribed_at.isoformat() if row.unsubscribed_at else "",
            row.source_post.title if row.source_post else "",
        )])

    add_audit_log(
        session,
        action="follower.export",
        resource_type="follower",
        blog_id=blog.id,
        actor=current_user,
        details={"status": status.value if status else "all", "rows": len(rows)},
        request=request,
    )
    session.commit()
    return buffer.getvalue()


def set_followers_enabled(
    blog: Blog,
    enabled: bool,
    current_user: User,
    request: Optional[Request],
    session: Session,
) -> bool:
    if blog.followers_enabled != enabled:
        blog.followers_enabled = enabled
        session.add(blog)
        add_audit_log(
            session,
            action="blog.followers_toggle",
            resource_type="blog",
            resource_id=blog.id,
            blog_id=blog.id,
            actor=current_user,
            details={"followers_enabled": enabled},
            request=request,
        )
        session.commit()
    return blog.followers_enabled
