"""
Comment notifications open the studio's Comments page at the comment:

- The post author is notified when someone else comments — not for their
  own comments — with who said it and an excerpt of what they said.
- Comment and reply notifications link to
  /admin/w/{slug}/comments?post={id}&highlight={comment id}.
- The workspace comment list filters by post, and `focus` returns the page
  that contains a given comment.
"""

from sqlmodel import Session, select

from app.core.db import engine
from app.models import Blog, Notification
from app.modules.comments.service import NOTIFICATION_EXCERPT_LENGTH
from tests.test_comment_notifications import _add_editor
from tests.test_comment_rules import _auth, _comment
from tests.test_comments_endpoints import _create_post, _register_owner


def _notifications(user_id: int, type_: str) -> list[Notification]:
    with Session(engine) as session:
        return session.exec(
            select(Notification).where(Notification.user_id == user_id, Notification.type == type_)
        ).all()


def _slug(blog_id: int) -> str:
    with Session(engine) as session:
        return session.get(Blog, blog_id).slug


# ── Post author notifications ─────────────────────────────────────────────────

def test_post_author_is_notified_with_an_excerpt_and_a_comments_link(client):
    _, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    reader_token, _, _ = _register_owner(client)

    comment_id = _comment(client, reader_token, post_id, content="Great point about scaling!").json()["id"]

    [note] = _notifications(owner_id, "comment_created")
    assert note.body == 'Ada Lovelace: "Great point about scaling!"'
    assert note.link == f"/admin/w/{_slug(blog_id)}/comments?post={post_id}&highlight={comment_id}"


def test_post_author_is_not_notified_about_their_own_comment(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)

    assert _comment(client, owner_token, post_id, content="My own comment").status_code == 200
    assert _notifications(owner_id, "comment_created") == []


def test_long_comments_are_cut_and_whitespace_collapsed(client):
    _, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    reader_token, _, _ = _register_owner(client)

    _comment(client, reader_token, post_id, content="First line\n\n" + "word " * 60)

    [note] = _notifications(owner_id, "comment_created")
    excerpt = note.body.split(": ", 1)[1].strip('"')
    assert "\n" not in excerpt and "  " not in excerpt
    assert excerpt.startswith("First line word")
    assert excerpt.endswith("…")
    assert len(excerpt) == NOTIFICATION_EXCERPT_LENGTH


def test_reply_notification_highlights_the_reply(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    editor_token, editor_id = _add_editor(client, blog_id)
    reader_token, _, _ = _register_owner(client)

    parent = _comment(client, editor_token, post_id, content="Editor's note").json()["id"]
    reply = _comment(client, reader_token, post_id, content="Thanks!", parent_id=parent).json()["id"]

    [note] = _notifications(editor_id, "comment_reply")
    assert note.body == 'Ada Lovelace: "Thanks!"'
    assert note.link == f"/admin/w/{_slug(blog_id)}/comments?post={post_id}&highlight={reply}"


# ── Comment list: post filter and focus ───────────────────────────────────────

def test_workspace_list_filters_by_post_and_carries_the_post_slug(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_a = _create_post(blog_id, owner_id)
    post_b = _create_post(blog_id, owner_id)
    reader_token, _, _ = _register_owner(client)
    _comment(client, reader_token, post_a, content="On A")
    _comment(client, reader_token, post_b, content="On B")

    res = client.get(f"/blogs/{blog_id}/comments/", params={"post_id": post_a}, headers=_auth(owner_token))
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert [c["content"] for c in items] == ["On A"]
    assert items[0]["post"]["slug"]


def test_focus_returns_the_page_containing_the_comment(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    reader_token, _, _ = _register_owner(client)
    ids = [_comment(client, reader_token, post_id, content=f"Comment {n}").json()["id"] for n in range(5)]

    # Newest first, two per page: [4, 3] [2, 1] [0] — the oldest is on the third page.
    res = client.get(
        f"/blogs/{blog_id}/comments/",
        params={"post_id": post_id, "focus": ids[0], "limit": 2},
        headers=_auth(owner_token),
    ).json()
    assert res["skip"] == 4
    assert [c["id"] for c in res["items"]] == [ids[0]]

    res = client.get(
        f"/blogs/{blog_id}/comments/",
        params={"post_id": post_id, "focus": ids[2], "limit": 2},
        headers=_auth(owner_token),
    ).json()
    assert res["skip"] == 2
    assert ids[2] in [c["id"] for c in res["items"]]


def test_focus_on_a_comment_outside_the_list_keeps_the_requested_page(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_a = _create_post(blog_id, owner_id)
    post_b = _create_post(blog_id, owner_id)
    reader_token, _, _ = _register_owner(client)
    _comment(client, reader_token, post_a, content="On A")
    other = _comment(client, reader_token, post_b, content="On B").json()["id"]

    res = client.get(
        f"/blogs/{blog_id}/comments/",
        params={"post_id": post_a, "focus": other},
        headers=_auth(owner_token),
    ).json()
    assert res["skip"] == 0
    assert [c["content"] for c in res["items"]] == ["On A"]
