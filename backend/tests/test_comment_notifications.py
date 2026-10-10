"""
Reply notifications: a team member is notified when someone replies to their
comment. Notifications only surface in the admin studio, so plain readers
aren't notified; nor is anyone replying to themselves, nor the post author
(who already gets the "new comment" notification).
"""

from sqlmodel import Session, select

from app.core.db import engine
from app.models import BlogMember, Notification
from app.models.blog import BlogRole
from tests.test_comment_rules import _comment
from tests.test_comments_endpoints import _create_post, _register_owner


def _reply_notifications(user_id: int) -> list[Notification]:
    with Session(engine) as session:
        return session.exec(
            select(Notification).where(Notification.user_id == user_id, Notification.type == "comment_reply")
        ).all()


def _add_editor(client, blog_id: int) -> tuple[str, int]:
    token, _, user_id = _register_owner(client)
    with Session(engine) as session:
        session.add(BlogMember(user_id=user_id, blog_id=blog_id, role=BlogRole.EDITOR))
        session.commit()
    return token, user_id


def test_team_member_is_notified_of_a_reply(client):
    _, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    editor_token, editor_id = _add_editor(client, blog_id)
    reader_token, _, _ = _register_owner(client)

    parent = _comment(client, editor_token, post_id, content="Editor's note").json()["id"]
    assert _comment(client, reader_token, post_id, content="Reply", parent_id=parent).status_code == 200

    notifications = _reply_notifications(editor_id)
    assert len(notifications) == 1
    assert notifications[0].blog_id == blog_id
    assert notifications[0].link == f"/admin/posts/view/{post_id}?blog={blog_id}"


def test_plain_reader_is_not_notified(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    reader_token, _, reader_id = _register_owner(client)

    parent = _comment(client, reader_token, post_id, content="Reader comment").json()["id"]
    _comment(client, owner_token, post_id, content="Owner reply", parent_id=parent)

    assert _reply_notifications(reader_id) == []


def test_self_reply_and_post_author_get_no_reply_notification(client):
    owner_token, blog_id, owner_id = _register_owner(client)
    post_id = _create_post(blog_id, owner_id)
    reader_token, _, _ = _register_owner(client)

    parent = _comment(client, owner_token, post_id, content="Owner comment").json()["id"]
    _comment(client, owner_token, post_id, content="Owner self-reply", parent_id=parent)
    _comment(client, reader_token, post_id, content="Reader reply", parent_id=parent)

    assert _reply_notifications(owner_id) == []
