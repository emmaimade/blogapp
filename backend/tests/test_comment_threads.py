"""
Comment thread shape and lifecycle:

- Replies are returned nested under their top-level comment, oldest first
  (the `replies` relationship used to point at the parent, so they never were).
- Threads are paginated; `total` counts top-level comments and
  `comment_count` counts every live comment, replies included.
- Deleting keeps the original text: the public thread masks it, the
  workspace moderation list shows it.
- Edits stamp `edited_at`.
- Post detail carries `comment_count` and no embedded comment list.
"""

from sqlmodel import Session

from app.core.db import engine
from app.models import Comment, Post
from tests.test_comment_rules import _auth, _comment
from tests.test_comments_endpoints import _create_post, _register_owner


def test_replies_are_returned_nested_under_their_parent(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    root = _comment(client, token, post_id, content="Root").json()["id"]
    _comment(client, token, post_id, content="First reply", parent_id=root)
    _comment(client, token, post_id, content="Second reply", parent_id=root)

    res = client.get(f"/comments/post/{post_id}")
    assert res.status_code == 200, res.text
    items = res.json()["items"]

    assert [c["content"] for c in items] == ["Root"]
    assert [r["content"] for r in items[0]["replies"]] == ["First reply", "Second reply"]
    assert items[0]["replies"][0]["user"]["id"] == user_id
    assert "replies" not in items[0]["replies"][0]


def test_thread_is_paginated_oldest_first(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    for n in range(5):
        _comment(client, token, post_id, content=f"Comment {n}")

    first = client.get(f"/comments/post/{post_id}", params={"limit": 2}).json()
    assert [c["content"] for c in first["items"]] == ["Comment 0", "Comment 1"]
    assert first["total"] == 5
    assert first["has_more"] is True

    last = client.get(f"/comments/post/{post_id}", params={"skip": 4, "limit": 2}).json()
    assert [c["content"] for c in last["items"]] == ["Comment 4"]
    assert last["has_more"] is False


def test_comment_count_includes_replies_and_excludes_deleted(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    root = _comment(client, token, post_id, content="Root").json()["id"]
    _comment(client, token, post_id, content="Reply", parent_id=root)
    doomed = _comment(client, token, post_id, content="Doomed").json()["id"]
    client.delete(f"/comments/{doomed}", headers=_auth(token))

    page = client.get(f"/comments/post/{post_id}").json()
    assert page["total"] == 2           # top-level rows, deleted one included
    assert page["comment_count"] == 2   # Root + Reply


def test_deleted_comment_text_is_masked_publicly_but_kept(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id, content="Original words").json()["id"]
    client.delete(f"/comments/{comment_id}", headers=_auth(token))

    public = client.get(f"/comments/post/{post_id}").json()["items"][0]
    assert public["is_deleted"] is True
    assert public["deleted_by"] == "author"
    assert public["content"] == "[This comment has been deleted by the author]"

    with Session(engine) as session:
        stored = session.get(Comment, comment_id)
        assert stored.content == "Original words"
        assert stored.deleted_at is not None


def test_workspace_moderation_list_shows_the_original_text(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    comment_id = _comment(client, token, post_id, content="Original words").json()["id"]
    client.delete(f"/comments/{comment_id}", headers=_auth(token))

    res = client.get(f"/blogs/{blog_id}/comments/", headers=_auth(token))
    assert res.status_code == 200, res.text
    row = next(c for c in res.json()["items"] if c["id"] == comment_id)
    assert row["content"] == "Original words"
    assert row["is_deleted"] is True


def test_workspace_moderation_list_is_paginated_newest_first(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    for n in range(3):
        _comment(client, token, post_id, content=f"Comment {n}")

    res = client.get(f"/blogs/{blog_id}/comments/", params={"limit": 2}, headers=_auth(token)).json()
    assert [c["content"] for c in res["items"]] == ["Comment 2", "Comment 1"]
    assert res["total"] == 3
    assert res["has_more"] is True


def test_editing_stamps_edited_at(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    created = _comment(client, token, post_id).json()
    assert created["edited_at"] is None

    edited = client.patch(f"/comments/{created['id']}", json={"content": "Changed"}, headers=_auth(token))
    assert edited.status_code == 200, edited.text
    assert edited.json()["edited_at"] is not None


def test_post_detail_carries_a_count_not_the_thread(client):
    token, blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id)
    root = _comment(client, token, post_id).json()["id"]
    _comment(client, token, post_id, content="Reply", parent_id=root)

    with Session(engine) as session:
        slug = session.get(Post, post_id).slug

    for url in (f"/blogs/{blog_id}/posts/{post_id}", f"/blogs/{blog_id}/posts/slug/{slug}"):
        res = client.get(url, headers=_auth(token))
        assert res.status_code == 200, res.text
        assert res.json()["comment_count"] == 2
        assert "comments" not in res.json()
