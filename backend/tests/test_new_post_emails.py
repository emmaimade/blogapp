"""
New-post emails to followers: when a post is queued (first time live only,
opt-out, samples, the scheduler), who it goes to (active followers from
before it went live), and the cron sender — batches over one connection, a
cursor that resumes across runs without duplicates, the daily limit, the
off switch, stale queues, refused recipients, a dropped connection, the
unsubscribe headers and one-click endpoint, and the team-only status.
"""

import smtplib
import uuid
from contextlib import contextmanager
from datetime import timedelta
from email import message_from_string

import pytest
from sqlmodel import Session, select

from app.core.config import settings
from app.core.datetimes import utc_now
from app.core.db import engine
from app.core.scheduler import publish_due_posts
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import BlogFollower, FollowerEmailStatus, FollowerStatus, Notification, Post, User
from app.models.post import PostStatus
from app.modules.followers import emails as follower_emails
from app.modules.followers.emails import run_follower_emails
from app.modules.followers.service import unsubscribe_token
from app.modules.posts import service as post_service
from app.schemas import PostCreate, PostUpdate


class FakeSMTP:
    """Records what would be sent; can refuse addresses or drop after a number of sends."""

    def __init__(self):
        self.sent: list[tuple[str, object]] = []
        self.refuse: set[str] = set()
        self.drop_after: int | None = None

    def sendmail(self, from_addr, to_addr, message):
        if self.drop_after is not None and len(self.sent) >= self.drop_after:
            raise smtplib.SMTPServerDisconnected("gone")
        if to_addr in self.refuse:
            raise smtplib.SMTPRecipientsRefused({to_addr: (550, b"no such user")})
        self.sent.append((to_addr, message_from_string(message)))

    def to(self, emails) -> list[str]:
        """Recipients among `emails`, in send order (other tests' posts may share a run)."""
        wanted = set(emails)
        return [to for to, _ in self.sent if to in wanted]


@pytest.fixture
def smtp(monkeypatch):
    server = FakeSMTP()

    @contextmanager
    def connection():
        yield server

    monkeypatch.setattr("app.core.email.smtp_connection", connection)
    monkeypatch.setattr(settings, "FOLLOWER_EMAILS_ENABLED", True)
    monkeypatch.setattr(settings, "FOLLOWER_EMAILS_DAILY_LIMIT", 1_000_000)
    monkeypatch.setattr(settings, "PUBLIC_API_URL", None)
    return server


def _register(client) -> tuple[dict, int, int]:
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": f"user-{uuid.uuid4().hex[:12]}@example.com",
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    client.cookies.clear()
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _create(blog_id: int, user_id: int, status: str = "published", **fields) -> int:
    with Session(engine) as session:
        user = session.get(User, user_id)
        post = post_service.create_post(
            blog_id, PostCreate(title=f"Post {uuid.uuid4().hex[:6]}", content="Body of the post.", status=status, **fields),
            session, user,
        )
        return post.id


def _update(blog_id: int, post_id: int, user_id: int, **fields) -> None:
    with Session(engine) as session:
        post_service.update_post(blog_id, post_id, PostUpdate(**fields), session, session.get(User, user_id))


def _post(post_id: int) -> Post:
    with Session(engine) as session:
        return session.get(Post, post_id)


def _followers(blog_id: int, count: int, *, confirmed_ago=timedelta(days=1), status=FollowerStatus.ACTIVE) -> list[str]:
    emails = [f"reader-{uuid.uuid4().hex[:10]}@example.com" for _ in range(count)]
    with Session(engine) as session:
        for address in emails:
            session.add(BlogFollower(blog_id=blog_id, email=address, status=status, confirmed_at=utc_now() - confirmed_ago))
        session.commit()
    return emails


def _run():
    with Session(engine) as session:
        return run_follower_emails(session)


# ── Queueing ─────────────────────────────────────────────────────────────────

def test_publishing_queues_and_drafts_dont(client):
    _, blog_id, user_id = _register(client)

    live = _create(blog_id, user_id)
    draft = _create(blog_id, user_id, status="draft")

    assert _post(live).follower_email_status == FollowerEmailStatus.PENDING
    assert _post(live).follower_email_queued_at is not None
    assert _post(draft).follower_email_status == FollowerEmailStatus.NONE


def test_a_draft_queues_when_it_first_goes_live_and_never_again(client, smtp):
    _, blog_id, user_id = _register(client)
    post_id = _create(blog_id, user_id, status="draft")

    _update(blog_id, post_id, user_id, status="published")
    queued_at = _post(post_id).follower_email_queued_at
    assert _post(post_id).follower_email_status == FollowerEmailStatus.PENDING
    _run()
    _update(blog_id, post_id, user_id, content="An edit after it went out.")
    _update(blog_id, post_id, user_id, status="draft")
    _update(blog_id, post_id, user_id, status="published")

    assert _post(post_id).follower_email_status == FollowerEmailStatus.SENT
    assert _post(post_id).follower_email_queued_at == queued_at


def test_opting_out_samples_and_unticking_while_pending_skip_it(client):
    _, blog_id, user_id = _register(client)

    opted_out = _create(blog_id, user_id, notify_followers=False)
    unticked = _create(blog_id, user_id)
    _update(blog_id, unticked, user_id, notify_followers=False)
    with Session(engine) as session:
        sample = Post(title="Sample", slug=f"s-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id, is_sample=True,
                      status=PostStatus.PUBLISHED, published=True)
        follower_emails.queue_new_post(sample)

    assert _post(opted_out).follower_email_status == FollowerEmailStatus.SKIPPED
    assert _post(unticked).follower_email_status == FollowerEmailStatus.SKIPPED
    assert sample.follower_email_status == FollowerEmailStatus.SKIPPED


def test_the_scheduler_queues_a_post_it_releases(client):
    _, blog_id, user_id = _register(client)
    with Session(engine) as session:  # scheduling itself is a Pro feature; the release is what's tested
        post = Post(title="Later", slug=f"later-{uuid.uuid4().hex[:6]}", content="x", blog_id=blog_id, author_id=user_id,
                    status=PostStatus.SCHEDULED, published=False, published_at=utc_now() - timedelta(minutes=1))
        session.add(post)
        session.commit()
        post_id = post.id

    with Session(engine) as session:
        publish_due_posts(session)

    assert _post(post_id).follower_email_status == FollowerEmailStatus.PENDING


# ── Sending ──────────────────────────────────────────────────────────────────

def test_it_goes_to_active_followers_from_before_it_went_live(client, smtp):
    _, blog_id, user_id = _register(client)
    current = _followers(blog_id, 3)
    pending = _followers(blog_id, 1, status=FollowerStatus.PENDING)
    gone = _followers(blog_id, 1, status=FollowerStatus.UNSUBSCRIBED)
    later = _followers(blog_id, 1, confirmed_ago=timedelta(days=-1))  # confirmed after it went live
    post_id = _create(blog_id, user_id)

    run = _run()

    assert sorted(smtp.to(current + pending + gone + later)) == sorted(current)
    assert run.sent >= 3
    post = _post(post_id)
    assert post.follower_email_status == FollowerEmailStatus.SENT
    assert post.follower_emails_sent == 3
    with Session(engine) as session:
        note = session.exec(
            select(Notification).where(Notification.user_id == user_id, Notification.type == "post_emailed")
        ).one()
    assert "3 followers" in note.title


def test_the_email_links_the_post_and_can_be_unsubscribed_from(client, smtp, monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_API_URL", "https://api.example.com")
    _, blog_id, user_id = _register(client)
    [address] = _followers(blog_id, 1)
    post_id = _create(blog_id, user_id)

    _run()

    [message] = [m for to, m in smtp.sent if to == address]
    assert "via Inko" in message["From"]
    assert message["Subject"] == _post(post_id).title
    assert "/follow/unsubscribe?token=" in message["List-Unsubscribe"]
    assert "https://api.example.com/followers/unsubscribe/one-click?token=" in message["List-Unsubscribe"]
    assert message["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    text = message.get_payload()[0].get_payload(decode=True).decode()
    assert f"/post/{_post(post_id).slug}" in text


def test_one_click_unsubscribe(client):
    _, blog_id, _ = _register(client)
    [address] = _followers(blog_id, 1)
    with Session(engine) as session:
        follower = session.exec(select(BlogFollower).where(BlogFollower.email == address)).one()

    res = client.post("/followers/unsubscribe/one-click", params={"token": unsubscribe_token(follower.id)},
                      data={"List-Unsubscribe": "One-Click"})

    assert res.status_code == 200
    with Session(engine) as session:
        assert session.get(BlogFollower, follower.id).status == FollowerStatus.UNSUBSCRIBED


def test_nothing_is_sent_while_switched_off(client, smtp, monkeypatch):
    monkeypatch.setattr(settings, "FOLLOWER_EMAILS_ENABLED", False)
    _, blog_id, user_id = _register(client)
    followers = _followers(blog_id, 2)
    post_id = _create(blog_id, user_id)

    run = _run()

    assert run.stopped == "disabled"
    assert smtp.to(followers) == []
    assert _post(post_id).follower_email_status == FollowerEmailStatus.PENDING


def test_a_post_queued_too_long_ago_is_skipped(client, smtp):
    _, blog_id, user_id = _register(client)
    followers = _followers(blog_id, 2, confirmed_ago=timedelta(days=10))
    post_id = _create(blog_id, user_id)
    with Session(engine) as session:
        post = session.get(Post, post_id)
        post.follower_email_queued_at = utc_now() - timedelta(days=4)
        session.add(post)
        session.commit()

    _run()

    assert smtp.to(followers) == []
    assert _post(post_id).follower_email_status == FollowerEmailStatus.SKIPPED


def test_the_daily_limit_pauses_and_the_next_run_resumes_without_duplicates(client, smtp, monkeypatch):
    _, blog_id, user_id = _register(client)
    followers = _followers(blog_id, 5)
    post_id = _create(blog_id, user_id)
    with Session(engine) as session:
        already = follower_emails._sent_today(session)
    # Earlier posts in the queue (other tests') have no followers, so all of
    # today's allowance goes to this one.
    monkeypatch.setattr(settings, "FOLLOWER_EMAILS_DAILY_LIMIT", already + 2)

    first = _run()
    assert first.stopped == "daily limit"
    assert len(smtp.to(followers)) == 2
    assert _post(post_id).follower_email_status == FollowerEmailStatus.SENDING

    monkeypatch.setattr(settings, "FOLLOWER_EMAILS_DAILY_LIMIT", 1_000_000)
    _run()

    assert sorted(smtp.to(followers)) == sorted(followers)  # each exactly once
    assert _post(post_id).follower_email_status == FollowerEmailStatus.SENT


def test_a_refused_address_doesnt_stop_the_rest(client, smtp):
    _, blog_id, user_id = _register(client)
    followers = _followers(blog_id, 3)
    smtp.refuse.add(followers[1])
    post_id = _create(blog_id, user_id)

    run = _run()

    assert sorted(smtp.to(followers)) == sorted([followers[0], followers[2]])
    assert run.failed >= 1
    assert _post(post_id).follower_email_status == FollowerEmailStatus.SENT
    assert _post(post_id).follower_emails_sent == 2


def test_a_dropped_connection_keeps_what_was_sent(client, smtp, monkeypatch):
    monkeypatch.setattr(follower_emails, "BATCH_SIZE", 10)
    _, blog_id, user_id = _register(client)
    followers = _followers(blog_id, 4)
    post_id = _create(blog_id, user_id)
    smtp.drop_after = len(smtp.sent) + 2

    first = _run()
    assert first.stopped == "smtp error"
    assert len(smtp.to(followers)) == 2

    smtp.drop_after = None
    _run()

    assert sorted(smtp.to(followers)) == sorted(followers)  # nobody twice
    assert _post(post_id).follower_emails_sent == 4


# ── Status in the studio ─────────────────────────────────────────────────────

def test_status_is_for_the_team_only(client, smtp):
    owner, blog_id, user_id = _register(client)
    outsider, _, _ = _register(client)
    _followers(blog_id, 2)
    post_id = _create(blog_id, user_id)
    _run()

    res = client.get(f"/blogs/{blog_id}/posts/{post_id}/follower-email", headers=owner)
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["status"], body["sent"], body["recipients"]) == ("sent", 2, 2)
    assert body["sending_enabled"] is True

    assert client.get(f"/blogs/{blog_id}/posts/{post_id}/follower-email", headers=outsider).status_code == 403
    public = client.get(f"/blogs/{blog_id}/posts/slug/{_post(post_id).slug}").json()
    assert "follower_emails_sent" not in public and "follower_email_status" not in public
