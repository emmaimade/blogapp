"""
Coverage for the public-blog read paths: the opt-in reader view
(`public_view`) on list/search — published, non-sample posts whoever is
signed in — plus GET /posts/stats and GET /posts/slug/{slug}/related, and
the migration that turns old "Showcase Project" posts into a Projects tag.
"""

import importlib.util
from datetime import timedelta
import uuid
from pathlib import Path

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME, create_access_token
from app.models import User
from app.models import BlogMember, Post, Tag
from app.models.blog import BlogRole
from app.models.post import PostStatus


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:12]}@example.com"


def _register(client) -> tuple[int, int, str]:
    """Returns (own blog_id, user_id, access token). Clears the session so later calls are anonymous."""
    resp = client.post(
        "/users/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": _unique_email(),
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    token = client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    client.cookies.clear()
    return body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"], token


def _register_owner(client) -> tuple[int, int]:
    blog_id, user_id, _ = _register(client)
    return blog_id, user_id


def _add_member(client, blog_id: int, role: BlogRole) -> tuple[int, dict]:
    """A new user with `role` in blog_id — direct-inserted, since the invite flow isn't what's under test."""
    _, user_id, token = _register(client)
    with Session(engine) as session:
        session.add(BlogMember(user_id=user_id, blog_id=blog_id, role=role))
        session.commit()
    return user_id, {"Authorization": f"Bearer {token}"}


def _create_post(
    blog_id: int,
    author_id: int,
    *,
    status: PostStatus = PostStatus.PUBLISHED,
    is_sample: bool = False,
    is_project: bool = False,
    views: int = 0,
    tags: list[str] | None = None,
    title: str | None = None,
) -> str:
    with Session(engine) as session:
        tag_rows = []
        for name in tags or []:
            tag = session.exec(select(Tag).where(Tag.blog_id == blog_id, Tag.name == name)).first()
            if not tag:
                tag = Tag(name=name, blog_id=blog_id)
                session.add(tag)
                session.flush()
            tag_rows.append(tag)
        post = Post(
            title=title or f"Post {uuid.uuid4().hex[:8]}",
            slug=f"post-{uuid.uuid4().hex[:8]}",
            content="Body content.",
            blog_id=blog_id,
            author_id=author_id,
            status=status,
            published=status == PostStatus.PUBLISHED,
            is_sample=is_sample,
            is_project=is_project,
            views=views,
        )
        post.tags = tag_rows
        session.add(post)
        session.commit()
        return post.slug


def _sample_slugs(blog_id: int) -> set[str]:
    with Session(engine) as session:
        return set(session.exec(select(Post.slug).where(Post.blog_id == blog_id, Post.is_sample == True)).all())


# ── public_view ───────────────────────────────────────────────────────────────

def test_list_keeps_sample_posts_by_default_and_hides_them_on_request(client):
    blog_id, user_id = _register_owner(client)
    sample = _create_post(blog_id, user_id, is_sample=True)
    regular = _create_post(blog_id, user_id)

    default = {p["slug"] for p in client.get(f"/blogs/{blog_id}/posts/").json()["items"]}
    assert {sample, regular} <= default

    res = client.get(f"/blogs/{blog_id}/posts/", params={"public_view": "true"})
    body = res.json()
    slugs = {p["slug"] for p in body["items"]}
    assert regular in slugs
    assert not slugs & _sample_slugs(blog_id)
    assert body["total"] == len(slugs)


def test_search_hides_sample_posts_on_request(client):
    blog_id, user_id = _register_owner(client)
    marker = uuid.uuid4().hex[:8]
    sample = _create_post(blog_id, user_id, is_sample=True, title=f"Sample {marker}")
    regular = _create_post(blog_id, user_id, title=f"Regular {marker}")

    res = client.get(f"/blogs/{blog_id}/posts/search", params={"q": marker, "public_view": "true"})
    slugs = {p["slug"] for p in res.json()["items"]}
    assert slugs == {regular}
    assert sample not in slugs


def _list_slugs(client, blog_id: int, headers: dict | None = None, **params) -> set[str]:
    res = client.get(f"/blogs/{blog_id}/posts/", params={"limit": 100, **params}, headers=headers or {})
    assert res.status_code == 200, res.text
    return {p["slug"] for p in res.json()["items"]}


def _token_for(user_id: int, minutes: int) -> str:
    with Session(engine) as session:
        username = session.get(User, user_id).username
    return create_access_token({"sub": username}, expires_delta=timedelta(minutes=minutes))


def test_lapsed_session_on_the_admin_list_is_a_401_not_the_reader_view(client):
    """An expired token used to be treated as no token: the owner quietly got
    live posts only, and never the 401 that makes the studio refresh."""
    blog_id, owner_id, _ = _register(client)
    _create_post(blog_id, owner_id)
    _create_post(blog_id, owner_id, status=PostStatus.DRAFT)
    expired = {"Authorization": f"Bearer {_token_for(owner_id, -5)}"}

    res = client.get(f"/blogs/{blog_id}/posts/", headers=expired)

    assert res.status_code == 401, res.text
    assert res.json()["code"] == "SESSION_EXPIRED"


def test_malformed_token_on_the_admin_list_is_a_401(client):
    blog_id, _, _ = _register(client)

    res = client.get(f"/blogs/{blog_id}/posts/", headers={"Authorization": "Bearer not-a-token"})

    assert res.status_code == 401, res.text


def test_valid_session_on_the_admin_list_includes_drafts(client):
    blog_id, owner_id, _ = _register(client)
    published = _create_post(blog_id, owner_id)
    draft = _create_post(blog_id, owner_id, status=PostStatus.DRAFT)
    valid = {"Authorization": f"Bearer {_token_for(owner_id, 5)}"}

    assert {published, draft} <= _list_slugs(client, blog_id, valid)


def test_lapsed_session_still_reads_the_public_view_and_anonymous_still_works(client):
    """Readers are unaffected: the public blog always asks for public_view,
    and a request with no token at all is still the reader's list."""
    blog_id, owner_id, _ = _register(client)
    published = _create_post(blog_id, owner_id)
    draft = _create_post(blog_id, owner_id, status=PostStatus.DRAFT)
    expired = {"Authorization": f"Bearer {_token_for(owner_id, -5)}"}

    public = _list_slugs(client, blog_id, expired, public_view="true")
    anonymous = _list_slugs(client, blog_id)

    assert published in public and draft not in public
    assert published in anonymous and draft not in anonymous


def _post_id(slug: str) -> int:
    with Session(engine) as session:
        return session.exec(select(Post.id).where(Post.slug == slug)).one()


def test_lapsed_session_opening_a_draft_by_id_is_a_401_not_a_404(client):
    """The editor loads posts by id: an expired session used to make a draft
    look deleted ("post not found") instead of refreshing."""
    blog_id, owner_id, _ = _register(client)
    draft_id = _post_id(_create_post(blog_id, owner_id, status=PostStatus.DRAFT))

    expired = client.get(f"/blogs/{blog_id}/posts/{draft_id}",
                         headers={"Authorization": f"Bearer {_token_for(owner_id, -5)}"})
    valid = client.get(f"/blogs/{blog_id}/posts/{draft_id}",
                       headers={"Authorization": f"Bearer {_token_for(owner_id, 5)}"})

    assert expired.status_code == 401, expired.text
    assert expired.json()["code"] == "SESSION_EXPIRED"
    assert valid.status_code == 200, valid.text


def test_signed_out_visitor_opening_a_draft_by_id_still_gets_not_found(client):
    blog_id, owner_id, _ = _register(client)
    draft_id = _post_id(_create_post(blog_id, owner_id, status=PostStatus.DRAFT))

    assert client.get(f"/blogs/{blog_id}/posts/{draft_id}").status_code == 404


def test_owner_sees_drafts_only_outside_the_public_view(client):
    blog_id, owner_id, owner_token = _register(client)
    owner = {"Authorization": f"Bearer {owner_token}"}
    published = _create_post(blog_id, owner_id)
    draft = _create_post(blog_id, owner_id, status=PostStatus.DRAFT)
    scheduled = _create_post(blog_id, owner_id, status=PostStatus.SCHEDULED)

    # Admin behaviour is unchanged…
    assert {published, draft, scheduled} <= _list_slugs(client, blog_id, owner)
    # …but the reader view is the same as an anonymous reader's.
    public = _list_slugs(client, blog_id, owner, public_view="true")
    assert published in public
    assert not public & {draft, scheduled}
    assert public == _list_slugs(client, blog_id, public_view="true")


def test_editor_gets_the_reader_view_too(client):
    blog_id, owner_id = _register_owner(client)
    _, editor = _add_member(client, blog_id, BlogRole.EDITOR)
    published = _create_post(blog_id, owner_id)
    draft = _create_post(blog_id, owner_id, status=PostStatus.DRAFT)

    assert draft in _list_slugs(client, blog_id, editor)
    public = _list_slugs(client, blog_id, editor, public_view="true")
    assert published in public and draft not in public


def test_author_reader_view_shows_everyones_published_posts_and_none_of_their_drafts(client):
    blog_id, owner_id = _register_owner(client)
    author_id, author = _add_member(client, blog_id, BlogRole.AUTHOR)
    owners_post = _create_post(blog_id, owner_id)
    authors_post = _create_post(blog_id, author_id)
    authors_draft = _create_post(blog_id, author_id, status=PostStatus.DRAFT)

    # Admin behaviour is unchanged: an author's list is only their own posts.
    assert _list_slugs(client, blog_id, author) == {authors_post, authors_draft}

    public = _list_slugs(client, blog_id, author, public_view="true")
    assert {owners_post, authors_post} <= public
    assert authors_draft not in public


def test_public_view_ignores_a_status_filter(client):
    blog_id, owner_id, owner_token = _register(client)
    owner = {"Authorization": f"Bearer {owner_token}"}
    published = _create_post(blog_id, owner_id)
    draft = _create_post(blog_id, owner_id, status=PostStatus.DRAFT)

    slugs = _list_slugs(client, blog_id, owner, public_view="true", status="draft")
    assert published in slugs and draft not in slugs


# ── stats ────────────────────────────────────────────────────────────────────

def test_stats_count_only_public_non_sample_posts(client):
    blog_id, user_id = _register_owner(client)
    _create_post(blog_id, user_id, views=10)
    _create_post(blog_id, user_id, views=5)
    _create_post(blog_id, user_id, views=100, is_sample=True)
    _create_post(blog_id, user_id, views=1000, status=PostStatus.DRAFT)

    res = client.get(f"/blogs/{blog_id}/posts/stats")
    assert res.status_code == 200, res.text
    assert res.json() == {"articles": 2, "views": 15}


# ── project posts become a tag ───────────────────────────────────────────────

_TAG_PROJECTS_MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "alembic" / "versions" / "a4d7e2c9f1b3_tag_project_posts.py"
)


def _tag_project_posts() -> None:
    spec = importlib.util.spec_from_file_location("tag_project_posts", _TAG_PROJECTS_MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with engine.begin() as connection:
        module.tag_project_posts(connection)


def _tag_names(slug: str) -> set[str]:
    with Session(engine) as session:
        post = session.exec(select(Post).where(Post.slug == slug)).one()
        return {t.name for t in post.tags}


def _projects_tags(blog_id: int) -> list[Tag]:
    with Session(engine) as session:
        return session.exec(select(Tag).where(Tag.blog_id == blog_id, Tag.name.ilike("projects"))).all()


def test_project_posts_get_a_projects_tag_and_articles_do_not(client):
    blog_id, user_id = _register_owner(client)
    project = _create_post(blog_id, user_id, is_project=True, tags=["Design"])
    article = _create_post(blog_id, user_id)

    _tag_project_posts()

    assert _tag_names(project) == {"Design", "Projects"}
    assert _tag_names(article) == set()
    # Readers find them on the ordinary tag page.
    assert project in _list_slugs(client, blog_id, tag="Projects", public_view="true")


def test_tagging_project_posts_reuses_the_blogs_own_tag_and_is_repeatable(client):
    blog_id, user_id = _register_owner(client)
    already_tagged = _create_post(blog_id, user_id, is_project=True, tags=["projects"])
    untagged = _create_post(blog_id, user_id, is_project=True)

    _tag_project_posts()
    _tag_project_posts()

    tags = _projects_tags(blog_id)
    assert [t.name for t in tags] == ["projects"]
    assert _tag_names(already_tagged) == {"projects"}
    assert _tag_names(untagged) == {"projects"}


def test_tagging_project_posts_leaves_blogs_without_projects_alone(client):
    blog_id, user_id = _register_owner(client)
    _create_post(blog_id, user_id)

    _tag_project_posts()

    assert _projects_tags(blog_id) == []


# ── related ──────────────────────────────────────────────────────────────────

def test_related_posts_rank_by_shared_tags(client):
    blog_id, user_id = _register_owner(client)
    current = _create_post(blog_id, user_id, tags=["python", "web", "api"])
    two_shared = _create_post(blog_id, user_id, tags=["python", "web"])
    one_shared = _create_post(blog_id, user_id, tags=["api"])
    _create_post(blog_id, user_id, tags=["cooking"])
    _create_post(blog_id, user_id, tags=["python"], status=PostStatus.DRAFT)
    _create_post(blog_id, user_id, tags=["python", "web", "api"], is_sample=True)

    res = client.get(f"/blogs/{blog_id}/posts/slug/{current}/related")
    assert res.status_code == 200, res.text
    assert [p["slug"] for p in res.json()] == [two_shared, one_shared]


def test_related_posts_respect_limit_and_handle_untagged_or_unknown(client):
    blog_id, user_id = _register_owner(client)
    current = _create_post(blog_id, user_id, tags=["go"])
    for _ in range(4):
        _create_post(blog_id, user_id, tags=["go"])
    untagged = _create_post(blog_id, user_id)

    assert len(client.get(f"/blogs/{blog_id}/posts/slug/{current}/related", params={"limit": 2}).json()) == 2
    assert client.get(f"/blogs/{blog_id}/posts/slug/{untagged}/related").json() == []
    assert client.get(f"/blogs/{blog_id}/posts/slug/does-not-exist/related").json() == []


def _post_id(slug: str) -> int:
    with Session(engine) as session:
        return session.exec(select(Post.id).where(Post.slug == slug)).one()


def test_reading_a_draft_by_id_404s_for_anonymous_and_outside_users(client):
    """GET /posts/{id} used to return drafts to anyone; the slug route already didn't."""
    blog_id, user_id = _register_owner(client)
    for status in (PostStatus.DRAFT, PostStatus.SCHEDULED):
        post_id = _post_id(_create_post(blog_id, user_id, status=status))

        anonymous = client.get(f"/blogs/{blog_id}/posts/{post_id}")
        assert anonymous.status_code == 404, anonymous.text

        _, _, outsider_token = _register(client)
        outsider = client.get(
            f"/blogs/{blog_id}/posts/{post_id}", headers={"Authorization": f"Bearer {outsider_token}"}
        )
        assert outsider.status_code == 404, outsider.text


def test_team_members_can_read_a_draft_by_id(client):
    blog_id, user_id = _register_owner(client)
    post_id = _post_id(_create_post(blog_id, user_id, status=PostStatus.DRAFT))

    for role in (BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR):
        _, headers = _add_member(client, blog_id, role)
        res = client.get(f"/blogs/{blog_id}/posts/{post_id}", headers=headers)
        assert res.status_code == 200, (role, res.text)


def test_published_post_by_id_is_public(client):
    blog_id, user_id = _register_owner(client)
    post_id = _post_id(_create_post(blog_id, user_id))

    res = client.get(f"/blogs/{blog_id}/posts/{post_id}")
    assert res.status_code == 200, res.text
