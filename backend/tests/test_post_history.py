"""
Post version history: which saves keep a version (article changes, going
live, restoring) and which don't, the cap per post, reading versions back,
and who may see them (owners and editors any post, authors their own).
"""

import uuid

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import BlogMember, BlogRole, Post, User
from app.models.revision import PostRevision
from app.modules.posts import revisions as post_revisions
from app.modules.posts import service as post_service
from app.schemas import PostCreate, PostUpdate


def _register(client) -> tuple[dict, int, int]:
    resp = client.post("/users/register", json={
        "first_name": "Ada", "last_name": "Lovelace",
        "email": f"user-{uuid.uuid4().hex[:12]}@example.com", "password": "correcthorse1",
        "workspace_name": f"Blog {uuid.uuid4().hex[:6]}",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    client.cookies.clear()
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


# The post routes also require completed onboarding, which history doesn't
# touch — so, like test_post_publish_date, save through the service.
def _create(blog_id: int, user_id: int, **fields) -> int:
    with Session(engine) as session:
        data = {"title": "First draft", "content": "Hello world.", "status": "draft", **fields}
        return post_service.create_post(blog_id, PostCreate(**data), session, session.get(User, user_id)).id


def _update(blog_id: int, post_id: int, user_id: int, **fields) -> None:
    with Session(engine) as session:
        post_service.update_post(blog_id, post_id, PostUpdate(**fields), session, session.get(User, user_id))


def _reasons(post_id: int) -> list[str]:
    with Session(engine) as session:
        rows = session.exec(
            select(PostRevision).where(PostRevision.post_id == post_id).order_by(PostRevision.created_at, PostRevision.id)
        ).all()
        return [r.reason for r in rows]


def test_saving_a_change_keeps_a_version_and_unchanged_saves_dont(client):
    _, blog_id, user_id = _register(client)
    post_id = _create(blog_id, user_id)

    _update(blog_id, post_id, user_id, content="Hello again, world.")
    _update(blog_id, post_id, user_id, content="Hello again, world.")  # nothing changed
    _update(blog_id, post_id, user_id, is_featured=True)  # not the article itself

    assert _reasons(post_id) == ["saved", "saved"]


def test_going_live_keeps_a_version(client):
    _, blog_id, user_id = _register(client)
    post_id = _create(blog_id, user_id)

    _update(blog_id, post_id, user_id, status="published")

    assert _reasons(post_id) == ["saved", "published"]


def test_saving_a_restored_version_is_labelled_restored(client):
    _, blog_id, user_id = _register(client)
    post_id = _create(blog_id, user_id)
    _update(blog_id, post_id, user_id, content="A worse second version.")
    with Session(engine) as session:
        first = session.exec(select(PostRevision).where(PostRevision.post_id == post_id).order_by(PostRevision.id)).first()

    _update(blog_id, post_id, user_id, content=first.content, restored_from_revision_id=first.id)

    assert _reasons(post_id)[-1] == "restored"
    with Session(engine) as session:
        assert session.get(Post, post_id).content == "Hello world."


def test_only_the_newest_versions_are_kept(client, monkeypatch):
    monkeypatch.setattr(post_revisions, "MAX_REVISIONS", 3)
    _, blog_id, user_id = _register(client)
    post_id = _create(blog_id, user_id)

    for n in range(5):
        _update(blog_id, post_id, user_id, content=f"Version {n}")

    with Session(engine) as session:
        kept = session.exec(select(PostRevision).where(PostRevision.post_id == post_id)).all()
        assert sorted(r.content for r in kept) == ["Version 2", "Version 3", "Version 4"]


def test_versions_can_be_listed_and_read(client):
    owner, blog_id, user_id = _register(client)
    post_id = _create(blog_id, user_id, content="one two three")
    _update(blog_id, post_id, user_id, title="Better title")

    listed = client.get(f"/blogs/{blog_id}/posts/{post_id}/revisions", headers=owner)
    assert listed.status_code == 200, listed.text
    versions = listed.json()
    assert [v["title"] for v in versions] == ["Better title", "First draft"]  # newest first
    assert versions[1]["words"] == 3 and versions[1]["saved_by_name"] == "Ada Lovelace"

    one = client.get(f"/blogs/{blog_id}/posts/{post_id}/revisions/{versions[1]['id']}", headers=owner)
    assert one.json()["content"] == "one two three"


def test_authors_see_only_their_own_posts_history(client):
    owner, blog_id, owner_id = _register(client)
    author, _, author_id = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(blog_id=blog_id, user_id=author_id, role=BlogRole.AUTHOR))
        session.commit()
    owners_post = _create(blog_id, owner_id)
    authors_post = _create(blog_id, author_id)

    assert client.get(f"/blogs/{blog_id}/posts/{authors_post}/revisions", headers=author).status_code == 200
    assert client.get(f"/blogs/{blog_id}/posts/{owners_post}/revisions", headers=author).status_code == 404
    assert client.get(f"/blogs/{blog_id}/posts/{authors_post}/revisions", headers=owner).status_code == 200


def test_a_version_of_another_post_isnt_found(client):
    owner, blog_id, user_id = _register(client)
    first = _create(blog_id, user_id)
    second = _create(blog_id, user_id)
    with Session(engine) as session:
        other_version = session.exec(select(PostRevision).where(PostRevision.post_id == second)).first()

    res = client.get(f"/blogs/{blog_id}/posts/{first}/revisions/{other_version.id}", headers=owner)

    assert res.status_code == 404
