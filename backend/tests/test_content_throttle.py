"""
Abuse protection on reader-generated content (app/services/content_throttle.py):

- Per-user comment rate limits, answered with 429 + Retry-After.
- The same comment re-posted on the same post within a minute is a 409.
- Per-user report rate limit.
- Comments can't be reported by their own author, or once deleted, and
  moderation snapshots carry the username rather than the email.
"""

from datetime import timedelta

from sqlmodel import Session, select

from app.core.db import engine
from app.models import Comment, ModerationItem, User
from app.models.comment import utcnow
from app.services import content_throttle
from tests.test_comment_rules import _auth, _comment
from tests.test_comments_endpoints import _create_post, _register_owner


def test_commenting_faster_than_the_per_minute_limit_is_throttled(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    _, per_minute = content_throttle.COMMENT_LIMITS[0]

    for n in range(per_minute):
        assert _comment(client, token, post_id, content=f"Comment {n}").status_code == 200

    res = _comment(client, token, post_id, content="One too many")
    assert res.status_code == 429, res.text
    assert res.json()["code"] == "RATE_LIMITED"
    assert 1 <= int(res.headers["Retry-After"]) <= 60


def test_daily_comment_limit_is_enforced(client, monkeypatch):
    monkeypatch.setattr(content_throttle, "COMMENT_LIMITS", ((timedelta(days=1), 2),))
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    assert _comment(client, token, post_id, content="One").status_code == 200
    assert _comment(client, token, post_id, content="Two").status_code == 200
    res = _comment(client, token, post_id, content="Three")
    assert res.status_code == 429, res.text


def test_throttle_is_per_user(client):
    token, blog_id, user_id = _register_owner(client)
    other_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    _, per_minute = content_throttle.COMMENT_LIMITS[0]

    for n in range(per_minute):
        _comment(client, token, post_id, content=f"Comment {n}")

    assert _comment(client, other_token, post_id, content="Someone else").status_code == 200


def test_reposting_the_same_comment_is_rejected(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    assert _comment(client, token, post_id, content="Great read").status_code == 200
    res = _comment(client, token, post_id, content="  Great read ")
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "DUPLICATE_COMMENT"


def test_same_text_is_fine_on_another_post_or_after_the_window(client):
    token, blog_id, user_id = _register_owner(client)
    post_a = _create_post(blog_id, user_id)
    post_b = _create_post(blog_id, user_id)

    first = _comment(client, token, post_a, content="Great read")
    assert _comment(client, token, post_b, content="Great read").status_code == 200

    with Session(engine) as session:
        comment = session.get(Comment, first.json()["id"])
        comment.created_at = utcnow() - content_throttle.DUPLICATE_COMMENT_WINDOW - timedelta(seconds=1)
        session.add(comment)
        session.commit()

    assert _comment(client, token, post_a, content="Great read").status_code == 200


def test_reporting_faster_than_the_limit_is_throttled(client, monkeypatch):
    monkeypatch.setattr(content_throttle, "REPORT_LIMITS", ((timedelta(hours=1), 2),))
    token, blog_id, user_id = _register_owner(client)
    posts = [_create_post(blog_id, user_id) for _ in range(3)]

    for post_id in posts[:2]:
        res = client.post(f"/blogs/{blog_id}/posts/{post_id}/flag", json={"reason": "spam"}, headers=_auth(token))
        assert res.status_code == 201, res.text

    res = client.post(f"/blogs/{blog_id}/posts/{posts[2]}/flag", json={"reason": "spam"}, headers=_auth(token))
    assert res.status_code == 429, res.text
    assert "Retry-After" in res.headers


def test_cannot_report_your_own_comment(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id).json()["id"]

    res = client.post(f"/comments/{comment_id}/flag", json={"reason": "spam"}, headers=_auth(token))
    assert res.status_code == 400, res.text


def test_cannot_report_a_deleted_comment(client):
    token, blog_id, user_id = _register_owner(client)
    reporter_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id).json()["id"]
    client.delete(f"/comments/{comment_id}", headers=_auth(token))

    res = client.post(f"/comments/{comment_id}/flag", json={"reason": "spam"}, headers=_auth(reporter_token))
    assert res.status_code == 400, res.text


def test_moderation_snapshot_records_username_not_email(client):
    token, blog_id, user_id = _register_owner(client)
    reporter_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id).json()["id"]

    res = client.post(f"/comments/{comment_id}/flag", json={"reason": "spam"}, headers=_auth(reporter_token))
    assert res.status_code == 201, res.text

    with Session(engine) as session:
        author = session.get(User, user_id)
        item = session.exec(select(ModerationItem).where(ModerationItem.id == res.json()["id"])).one()
        assert item.snapshot_author == author.username
        assert "@" not in (item.snapshot_author or "")
