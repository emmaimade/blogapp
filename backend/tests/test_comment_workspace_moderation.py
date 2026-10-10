"""
Workspace comment moderation (app/modules/comments/workspace.py):

- Authors see and moderate only comments on their own posts; owners and
  editors see every comment on the blog.
- The list filters by status (active / removed / reported) and carries each
  comment's open report count and whether it can be restored.
- Only moderator removals can be restored — not author deletions, not
  platform removals (except by a superadmin), not pre-retention deletions.
- Owners/editors can block a reader from commenting; blocked readers get a
  403, and team members can't be blocked.
"""

from sqlmodel import Session

from app.core.db import engine
from app.models import Blog, BlogMember, Comment, OnboardingStatus
from app.models.blog import BlogRole
from app.models.comment import CommentDeletedBy
from app.modules.comments.service import soft_delete_comment
from tests.test_comment_rules import _auth, _comment
from tests.test_comments_endpoints import _create_post, _register_owner


def _workspace(client) -> tuple[str, int, int]:
    """An owner whose workspace has finished onboarding (moderation writes require it)."""
    token, blog_id, user_id = _register_owner(client)
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(blog)
        session.commit()
    return token, blog_id, user_id


def _add_member(client, blog_id: int, role: BlogRole) -> tuple[str, int]:
    token, _, user_id = _register_owner(client)
    with Session(engine) as session:
        session.add(BlogMember(user_id=user_id, blog_id=blog_id, role=role))
        session.commit()
    return token, user_id


def _list(client, token: str, blog_id: int, **params) -> dict:
    res = client.get(f"/blogs/{blog_id}/comments/", params=params, headers=_auth(token))
    assert res.status_code == 200, res.text
    return res.json()


# ── Author scope ──────────────────────────────────────────────────────────────

def test_author_sees_and_moderates_only_comments_on_their_own_posts(client):
    owner_token, blog_id, owner_id = _workspace(client)
    author_token, author_id = _add_member(client, blog_id, BlogRole.AUTHOR)
    reader_token, _, _ = _register_owner(client)
    own_post = _create_post(blog_id, author_id)
    other_post = _create_post(blog_id, owner_id)
    on_own = _comment(client, reader_token, own_post, content="On the author's post").json()["id"]
    on_other = _comment(client, reader_token, other_post, content="On the owner's post").json()["id"]

    ids = {c["id"] for c in _list(client, author_token, blog_id)["items"]}
    assert on_own in ids and on_other not in ids

    assert client.delete(f"/blogs/{blog_id}/comments/{on_own}", headers=_auth(author_token)).status_code == 200
    assert client.delete(f"/blogs/{blog_id}/comments/{on_other}", headers=_auth(author_token)).status_code == 404

    owner_ids = {c["id"] for c in _list(client, owner_token, blog_id)["items"]}
    assert {on_own, on_other} <= owner_ids


def test_non_members_cannot_list_workspace_comments(client):
    _, blog_id, _ = _workspace(client)
    outsider_token, _, _ = _register_owner(client)
    res = client.get(f"/blogs/{blog_id}/comments/", headers=_auth(outsider_token))
    assert res.status_code == 403, res.text


# ── Status filters and report counts ──────────────────────────────────────────

def test_status_filters_and_open_report_counts(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, _ = _register_owner(client)
    reporter_a, _, _ = _register_owner(client)
    reporter_b, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    active = _comment(client, reader_token, post_id, content="Fine").json()["id"]
    reported = _comment(client, reader_token, post_id, content="Questionable").json()["id"]
    removed = _comment(client, reader_token, post_id, content="Gone").json()["id"]
    for reporter in (reporter_a, reporter_b):
        client.post(f"/comments/{reported}/flag", json={"reason": "Spam"}, headers=_auth(reporter))
    client.delete(f"/blogs/{blog_id}/comments/{removed}", headers=_auth(owner_token))

    def ids(status):
        return {c["id"] for c in _list(client, owner_token, blog_id, status=status)["items"]}

    assert ids("active") == {active, reported}
    assert ids("removed") == {removed}
    assert ids("reported") == {reported}

    by_id = {c["id"]: c for c in _list(client, owner_token, blog_id)["items"]}
    assert by_id[reported]["open_reports"] == 2
    assert by_id[active]["open_reports"] == 0
    assert by_id[removed]["can_restore"] is True
    assert by_id[active]["can_restore"] is False


def test_removing_a_reported_comment_takes_it_off_the_reported_list(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, _ = _register_owner(client)
    reporter_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    comment_id = _comment(client, reader_token, post_id, content="Spam").json()["id"]
    client.post(f"/comments/{comment_id}/flag", json={"reason": "Spam"}, headers=_auth(reporter_token))

    client.delete(f"/blogs/{blog_id}/comments/{comment_id}", headers=_auth(owner_token))

    assert _list(client, owner_token, blog_id, status="reported")["items"] == []
    removed = _list(client, owner_token, blog_id, status="removed")["items"]
    assert [c["open_reports"] for c in removed if c["id"] == comment_id] == [1]


# ── Restore ───────────────────────────────────────────────────────────────────

def test_moderator_removal_can_be_restored_with_its_original_text(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    comment_id = _comment(client, reader_token, post_id, content="Wrongly removed").json()["id"]
    client.delete(f"/blogs/{blog_id}/comments/{comment_id}", headers=_auth(owner_token))

    res = client.post(f"/blogs/{blog_id}/comments/{comment_id}/restore", headers=_auth(owner_token))
    assert res.status_code == 200, res.text
    assert res.json()["is_deleted"] is False

    public = client.get(f"/comments/post/{post_id}").json()["items"]
    assert next(c for c in public if c["id"] == comment_id)["content"] == "Wrongly removed"


def test_author_deletion_cannot_be_restored(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    comment_id = _comment(client, reader_token, post_id, content="I changed my mind").json()["id"]
    client.delete(f"/comments/{comment_id}", headers=_auth(reader_token))

    res = client.post(f"/blogs/{blog_id}/comments/{comment_id}/restore", headers=_auth(owner_token))
    assert res.status_code == 400, res.text
    assert "author" in res.json()["message"]


def test_platform_removal_cannot_be_restored_by_the_workspace(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    comment_id = _comment(client, reader_token, post_id, content="Removed by the platform").json()["id"]
    with Session(engine) as session:
        soft_delete_comment(session, session.get(Comment, comment_id), CommentDeletedBy.PLATFORM)
        session.commit()

    res = client.post(f"/blogs/{blog_id}/comments/{comment_id}/restore", headers=_auth(owner_token))
    assert res.status_code == 400, res.text


def test_pre_retention_deletion_cannot_be_restored(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    comment_id = _comment(client, reader_token, post_id, content="Old").json()["id"]
    with Session(engine) as session:
        comment = session.get(Comment, comment_id)
        comment.content = "[This comment has been deleted by a moderator]"
        soft_delete_comment(session, comment, CommentDeletedBy.MODERATOR)
        session.commit()

    res = client.post(f"/blogs/{blog_id}/comments/{comment_id}/restore", headers=_auth(owner_token))
    assert res.status_code == 400, res.text


# ── Blocking ──────────────────────────────────────────────────────────────────

def test_blocked_reader_cannot_comment_or_reply_until_unblocked(client):
    owner_token, blog_id, owner_id = _workspace(client)
    reader_token, _, reader_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    parent = _comment(client, owner_token, post_id, content="Owner's comment").json()["id"]

    ban = client.post(
        f"/blogs/{blog_id}/comments/bans", json={"user_id": reader_id, "reason": "Spam"}, headers=_auth(owner_token)
    )
    assert ban.status_code == 201, ban.text
    assert ban.json()["user"]["id"] == reader_id

    assert _comment(client, reader_token, post_id, content="Blocked").status_code == 403
    assert _comment(client, reader_token, post_id, content="Blocked reply", parent_id=parent).status_code == 403

    bans = client.get(f"/blogs/{blog_id}/comments/bans", headers=_auth(owner_token)).json()
    assert [b["user_id"] for b in bans] == [reader_id]

    unban = client.delete(f"/blogs/{blog_id}/comments/bans/{reader_id}", headers=_auth(owner_token))
    assert unban.status_code == 200, unban.text
    assert _comment(client, reader_token, post_id, content="Back again").status_code == 200


def test_block_is_per_blog(client):
    owner_token, blog_id, owner_id = _workspace(client)
    other_token, other_blog, other_owner = _workspace(client)
    reader_token, _, reader_id = _register_owner(client)
    other_post = _create_post(other_blog, other_owner)

    client.post(f"/blogs/{blog_id}/comments/bans", json={"user_id": reader_id}, headers=_auth(owner_token))
    assert _comment(client, reader_token, other_post, content="Elsewhere").status_code == 200


def test_team_members_and_yourself_cannot_be_blocked(client):
    owner_token, blog_id, owner_id = _workspace(client)
    _, editor_id = _add_member(client, blog_id, BlogRole.EDITOR)

    for user_id in (owner_id, editor_id):
        res = client.post(f"/blogs/{blog_id}/comments/bans", json={"user_id": user_id}, headers=_auth(owner_token))
        assert res.status_code == 400, res.text


def test_blocking_twice_conflicts_and_authors_cannot_block(client):
    owner_token, blog_id, _ = _workspace(client)
    author_token, _ = _add_member(client, blog_id, BlogRole.AUTHOR)
    _, _, reader_id = _register_owner(client)

    first = client.post(f"/blogs/{blog_id}/comments/bans", json={"user_id": reader_id}, headers=_auth(owner_token))
    again = client.post(f"/blogs/{blog_id}/comments/bans", json={"user_id": reader_id}, headers=_auth(owner_token))
    assert first.status_code == 201 and again.status_code == 409, again.text

    by_author = client.post(f"/blogs/{blog_id}/comments/bans", json={"user_id": reader_id}, headers=_auth(author_token))
    assert by_author.status_code == 403, by_author.text
