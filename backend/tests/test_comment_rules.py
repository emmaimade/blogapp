"""
Comment business rules:

- Content is stripped and length-checked on create and edit; edits are a JSON
  body, not a query string.
- A deleted (author- or moderator-removed) comment can't be edited back to
  life or deleted twice.
- Replies must target a live comment on the same post, and threads are one
  level deep.
- Only published posts on active blogs accept comments, and only team
  members can read the thread of an unpublished post.
- The platform-wide `feature_comments` switch is enforced.
"""

from sqlmodel import Session

from app.core.db import engine
from app.models import Blog, Comment, Post
from app.models.post import PostStatus
from app.schemas.comments import MAX_COMMENT_LENGTH
from tests.test_comments_endpoints import _create_post, _register_owner


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _comment(client, token: str, post_id: int, content: str = "Hello", parent_id: int | None = None):
    payload = {"content": content, "post_id": post_id}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    return client.post("/comments/", json=payload, headers=_auth(token))


def _set_post_status(post_id: int, status: PostStatus) -> None:
    with Session(engine) as session:
        post = session.get(Post, post_id)
        post.status = status
        post.published = status == PostStatus.PUBLISHED
        session.add(post)
        session.commit()


# ── Content validation ────────────────────────────────────────────────────────

def test_whitespace_only_comment_is_rejected(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    res = _comment(client, token, post_id, content="   \n\t ")
    assert res.status_code == 422, res.text


def test_comment_over_the_length_limit_is_rejected(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    res = _comment(client, token, post_id, content="x" * (MAX_COMMENT_LENGTH + 1))
    assert res.status_code == 422, res.text


def test_comment_content_is_stripped(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    res = _comment(client, token, post_id, content="  Nice post!  \n")
    assert res.status_code == 200, res.text
    assert res.json()["content"] == "Nice post!"


def test_edit_takes_a_json_body_and_is_validated(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id).json()["id"]

    ok = client.patch(f"/comments/{comment_id}", json={"content": "Edited"}, headers=_auth(token))
    assert ok.status_code == 200, ok.text
    assert ok.json()["content"] == "Edited"

    empty = client.patch(f"/comments/{comment_id}", json={"content": "  "}, headers=_auth(token))
    assert empty.status_code == 422, empty.text


# ── Deleted comments are final ────────────────────────────────────────────────

def test_author_cannot_edit_a_moderator_redacted_comment(client):
    """Previously a PATCH restored the text a moderator had removed."""
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id, content="Something abusive").json()["id"]

    with Session(engine) as session:
        comment = session.get(Comment, comment_id)
        comment.content = "[This comment has been deleted by a moderator]"
        comment.is_deleted = True
        session.add(comment)
        session.commit()

    res = client.patch(
        f"/comments/{comment_id}", json={"content": "Something abusive"}, headers=_auth(token)
    )
    assert res.status_code == 409, res.text
    assert res.json()["code"] == "COMMENT_DELETED"

    with Session(engine) as session:
        assert session.get(Comment, comment_id).content == "[This comment has been deleted by a moderator]"


def test_a_comment_cannot_be_deleted_twice(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id).json()["id"]

    first = client.delete(f"/comments/{comment_id}", headers=_auth(token))
    assert first.status_code == 200, first.text

    second = client.delete(f"/comments/{comment_id}", headers=_auth(token))
    assert second.status_code == 409, second.text
    assert second.json()["code"] == "COMMENT_DELETED"


def test_only_the_author_can_edit_a_comment(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    reader_token, _, _ = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    comment_id = _comment(client, owner_token, post_id).json()["id"]

    res = client.patch(f"/comments/{comment_id}", json={"content": "Hijacked"}, headers=_auth(reader_token))
    assert res.status_code == 403, res.text


# ── Replies ───────────────────────────────────────────────────────────────────

def test_reply_attaches_to_its_parent(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    parent_id = _comment(client, token, post_id).json()["id"]

    res = _comment(client, token, post_id, content="A reply", parent_id=parent_id)
    assert res.status_code == 200, res.text
    assert res.json()["parent_id"] == parent_id


def test_reply_to_a_reply_is_flattened_to_the_top_level_comment(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    root_id = _comment(client, token, post_id).json()["id"]
    reply_id = _comment(client, token, post_id, content="Reply", parent_id=root_id).json()["id"]

    res = _comment(client, token, post_id, content="Reply to reply", parent_id=reply_id)
    assert res.status_code == 200, res.text
    assert res.json()["parent_id"] == root_id


def test_reply_cannot_target_a_comment_on_another_post(client):
    token, blog_id, user_id = _register_owner(client)
    post_a = _create_post(blog_id, user_id)
    post_b = _create_post(blog_id, user_id)
    comment_on_a = _comment(client, token, post_a).json()["id"]

    res = _comment(client, token, post_b, content="Cross-post reply", parent_id=comment_on_a)
    assert res.status_code == 400, res.text


def test_reply_cannot_target_a_missing_comment(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    res = _comment(client, token, post_id, content="Orphan", parent_id=999_999)
    assert res.status_code == 400, res.text


def test_reply_cannot_target_a_deleted_comment(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    parent_id = _comment(client, token, post_id).json()["id"]
    client.delete(f"/comments/{parent_id}", headers=_auth(token))

    res = _comment(client, token, post_id, content="Too late", parent_id=parent_id)
    assert res.status_code == 400, res.text


def test_parent_id_zero_still_means_top_level(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    res = _comment(client, token, post_id, parent_id=0)
    assert res.status_code == 200, res.text
    assert res.json()["parent_id"] is None


# ── Post / blog visibility ────────────────────────────────────────────────────

def test_cannot_comment_on_a_draft_post(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    _set_post_status(post_id, PostStatus.DRAFT)

    res = _comment(client, token, post_id)
    assert res.status_code == 404, res.text
    assert res.json()["code"] == "POST_NOT_FOUND"


def test_cannot_comment_on_a_post_in_a_deactivated_blog(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.is_active = False
        session.add(blog)
        session.commit()

    res = _comment(client, token, post_id)
    assert res.status_code == 404, res.text


def test_anonymous_readers_cannot_list_comments_on_a_draft(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    _comment(client, token, post_id)
    _set_post_status(post_id, PostStatus.DRAFT)

    client.cookies.clear()
    res = client.get(f"/comments/post/{post_id}")
    assert res.status_code == 404, res.text


def test_team_members_can_still_list_comments_on_a_draft(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    _comment(client, token, post_id, content="Internal note")
    _set_post_status(post_id, PostStatus.DRAFT)

    res = client.get(f"/comments/post/{post_id}", headers=_auth(token))
    assert res.status_code == 200, res.text
    assert [c["content"] for c in res.json()] == ["Internal note"]


# ── Platform switch ───────────────────────────────────────────────────────────

def test_platform_comments_switch_blocks_new_comments(client, monkeypatch):
    from app.modules.superadmin import router as superadmin_router

    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)

    real_loader = superadmin_router._load_platform_settings

    def comments_off(session):
        settings = real_loader(session)
        settings.feature_comments = False
        return settings

    monkeypatch.setattr(superadmin_router, "_load_platform_settings", comments_off)

    res = _comment(client, token, post_id)
    assert res.status_code == 400, res.text
    assert res.json()["code"] == "OPERATION_NOT_ALLOWED"
