"""
Publish dates: a post keeps the date it first went live across edits and
unpublish/republish, and public lists sort by that date rather than by when
the post was first created.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Post, User
from app.models.post import PostStatus
from app.modules.posts import service as post_service
from app.schemas import PostUpdate


def _register_owner(client) -> tuple[int, int]:
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
    assert client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    body = resp.json()
    return body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _create_post(blog_id: int, author_id: int, **fields) -> int:
    with Session(engine) as session:
        post = Post(
            title=f"Post {uuid.uuid4().hex[:8]}",
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            **fields,
        )
        session.add(post)
        session.commit()
        return post.id


# update_post's HTTP route also requires completed onboarding, which this
# logic doesn't touch — so, like test_posts_pagination, call the service.
def _update(blog_id: int, post_id: int, user_id: int, data: PostUpdate) -> Post:
    with Session(engine) as session:
        user = session.get(User, user_id)
        post = post_service.update_post(blog_id, post_id, data, session, user)
        session.expunge(post)
        return post


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _published_post(blog_id: int, user_id: int, went_live: datetime) -> int:
    return _create_post(
        blog_id, user_id, status=PostStatus.PUBLISHED, published=True, published_at=went_live,
    )


def test_resaving_a_published_post_keeps_its_publish_date(client):
    """The editor's Update button sends status=published with no date; that
    must not reset an old post's publish date to now."""
    blog_id, user_id = _register_owner(client)
    went_live = datetime.now(timezone.utc) - timedelta(days=30)
    post_id = _published_post(blog_id, user_id, went_live)

    post = _update(blog_id, post_id, user_id, PostUpdate(title="Fixed a typo", status="published", published_at=None))

    assert _as_utc(post.published_at) == went_live


def test_unpublish_then_republish_keeps_the_original_date(client):
    blog_id, user_id = _register_owner(client)
    went_live = datetime.now(timezone.utc) - timedelta(days=30)
    post_id = _published_post(blog_id, user_id, went_live)

    unpublished = _update(blog_id, post_id, user_id, PostUpdate(status="draft", published_at=None))
    assert unpublished.status == PostStatus.DRAFT
    assert unpublished.published is False

    republished = _update(blog_id, post_id, user_id, PostUpdate(status="published"))
    assert republished.status == PostStatus.PUBLISHED
    assert _as_utc(republished.published_at) == went_live


def test_first_publish_of_a_draft_uses_now(client):
    blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id, status=PostStatus.DRAFT, published=False)

    before = datetime.now(timezone.utc)
    post = _update(blog_id, post_id, user_id, PostUpdate(status="published"))

    assert _as_utc(post.published_at) >= before - timedelta(seconds=1)


def test_unscheduled_post_does_not_keep_its_future_date(client):
    """A schedule that never fired isn't a publish date — moving the post back
    to draft drops it, and publishing later uses the real go-live time."""
    blog_id, user_id = _register_owner(client)
    future = datetime.now(timezone.utc) + timedelta(days=7)
    post_id = _create_post(blog_id, user_id, status=PostStatus.SCHEDULED, published=False, published_at=future)

    draft = _update(blog_id, post_id, user_id, PostUpdate(status="draft"))
    assert draft.published_at is None

    before = datetime.now(timezone.utc)
    published = _update(blog_id, post_id, user_id, PostUpdate(status="published"))
    assert before - timedelta(seconds=1) <= _as_utc(published.published_at) < future


def test_explicit_publish_date_is_respected(client):
    blog_id, user_id = _register_owner(client)
    went_live = datetime.now(timezone.utc) - timedelta(days=30)
    post_id = _published_post(blog_id, user_id, went_live)
    backdated = datetime.now(timezone.utc) - timedelta(days=365)

    post = _update(blog_id, post_id, user_id, PostUpdate(status="published", published_at=backdated))

    assert _as_utc(post.published_at) == backdated


def test_editing_a_live_post_records_the_edit_time(client):
    blog_id, user_id = _register_owner(client)
    post_id = _published_post(blog_id, user_id, datetime.now(timezone.utc) - timedelta(days=30))

    before = datetime.now(timezone.utc)
    post = _update(blog_id, post_id, user_id, PostUpdate(content="Revised body.", status="published"))

    assert post.edited_at is not None
    assert _as_utc(post.edited_at) >= before - timedelta(seconds=1)


def test_resave_without_content_changes_is_not_an_edit(client):
    """The editor resends every field; identical values, status changes and
    featuring aren't revisions readers should be told about."""
    blog_id, user_id = _register_owner(client)
    post_id = _published_post(blog_id, user_id, datetime.now(timezone.utc) - timedelta(days=30))
    with Session(engine) as session:
        original = session.get(Post, post_id)
        title, content = original.title, original.content

    post = _update(blog_id, post_id, user_id, PostUpdate(
        title=title, content=content, thumbnail_url=None, is_project=False,
        is_featured=True, tag_ids=[], status="published",
    ))
    assert post.edited_at is None

    post = _update(blog_id, post_id, user_id, PostUpdate(status="draft"))
    assert post.edited_at is None


def test_editing_a_post_that_never_went_live_is_not_an_edit(client):
    blog_id, user_id = _register_owner(client)
    post_id = _create_post(blog_id, user_id, status=PostStatus.DRAFT, published=False)

    post = _update(blog_id, post_id, user_id, PostUpdate(content="Still drafting."))
    assert post.edited_at is None

    post = _update(blog_id, post_id, user_id, PostUpdate(content="Ready.", status="published"))
    assert post.edited_at is None


def test_views_do_not_count_as_edits(client):
    blog_id, user_id = _register_owner(client)
    post_id = _published_post(blog_id, user_id, datetime.now(timezone.utc) - timedelta(days=30))
    with Session(engine) as session:
        before = session.get(Post, post_id)
        slug, updated_at = before.slug, before.updated_at

    for _ in range(2):
        res = client.get(f"/blogs/{blog_id}/posts/slug/{slug}")
        assert res.status_code == 200, res.text

    body = res.json()
    assert body["views"] == 2
    assert body["edited_at"] is None
    with Session(engine) as session:
        assert session.get(Post, post_id).updated_at == updated_at


def test_public_list_sorts_by_publish_date_not_creation(client):
    """A post written long ago but published today is the newest post."""
    blog_id, user_id = _register_owner(client)
    now = datetime.now(timezone.utc)
    older_draft_published_today = _create_post(
        blog_id, user_id,
        status=PostStatus.PUBLISHED, published=True,
        created_at=now - timedelta(days=60), published_at=now - timedelta(minutes=5),
    )
    published_last_week = _create_post(
        blog_id, user_id,
        status=PostStatus.PUBLISHED, published=True,
        created_at=now - timedelta(days=10), published_at=now - timedelta(days=7),
    )

    res = client.get(f"/blogs/{blog_id}/posts/?sort=latest&limit=12")
    assert res.status_code == 200, res.text
    ids = [item["id"] for item in res.json()["items"]]

    assert ids.index(older_draft_published_today) < ids.index(published_last_week)
    assert all(item.get("published_at") for item in res.json()["items"])
