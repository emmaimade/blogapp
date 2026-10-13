"""
`/blogs/{id}/tags/usage` feeds the studio's tag manager: every tag with how
many posts use it, drafts included, so the page can flag unused tags and warn
before a delete strips a tag from posts. Also covers tag-name trimming on
create and rename.
"""

from sqlmodel import Session

from app.core.db import engine
from app.models import Blog, BlogMember, Tag
from app.models.blog import BlogRole, OnboardingStatus
from tests.test_comment_rules import _auth
from tests.test_comments_endpoints import _register_owner
from tests.test_tags_popular import _seed


def _complete_onboarding(blog_id: int) -> None:
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_status = OnboardingStatus.COMPLETED
        session.add(blog)
        session.commit()


def test_usage_counts_drafts_and_unused_tags_sorted_by_name(client):
    token, blog_id, owner_id = _register_owner(client)
    _seed(
        blog_id,
        owner_id,
        [
            (True, ["zebra", "ai"]),
            (False, ["ai", "draft-only"]),
            (True, []),
        ],
    )
    with Session(engine) as session:
        session.add(Tag(name="unused", blog_id=blog_id))
        session.commit()

    res = client.get(f"/blogs/{blog_id}/tags/usage", headers=_auth(token))

    assert res.status_code == 200, res.text
    assert [(t["name"], t["post_count"]) for t in res.json()] == [
        ("ai", 2),
        ("draft-only", 1),
        ("unused", 0),
        ("zebra", 1),
    ]


def test_usage_is_limited_to_owners_and_editors(client):
    _, blog_id, _ = _register_owner(client)
    author_token, _, author_id = _register_owner(client)
    with Session(engine) as session:
        session.add(BlogMember(user_id=author_id, blog_id=blog_id, role=BlogRole.AUTHOR))
        session.commit()

    res = client.get(f"/blogs/{blog_id}/tags/usage", headers=_auth(author_token))

    assert res.status_code == 403, res.text


def test_public_list_is_sorted_by_name(client):
    _, blog_id, owner_id = _register_owner(client)
    _seed(blog_id, owner_id, [(True, ["mango", "apple", "kiwi"])])

    res = client.get(f"/blogs/{blog_id}/tags/")

    assert res.status_code == 200, res.text
    assert [t["name"] for t in res.json()] == ["apple", "kiwi", "mango"]


def test_create_and_rename_trim_the_name(client):
    token, blog_id, _ = _register_owner(client)
    _complete_onboarding(blog_id)

    created = client.post(f"/blogs/{blog_id}/tags/", json={"name": "  React  "}, headers=_auth(token))
    assert created.status_code == 200, created.text
    assert created.json()["name"] == "React"

    renamed = client.patch(
        f"/blogs/{blog_id}/tags/{created.json()['id']}", json={"name": " Vue "}, headers=_auth(token)
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Vue"


def test_blank_names_are_rejected(client):
    token, blog_id, _ = _register_owner(client)
    _complete_onboarding(blog_id)

    assert client.post(f"/blogs/{blog_id}/tags/", json={"name": "   "}, headers=_auth(token)).status_code == 422

    tag_id = client.post(f"/blogs/{blog_id}/tags/", json={"name": "Keep"}, headers=_auth(token)).json()["id"]
    res = client.patch(f"/blogs/{blog_id}/tags/{tag_id}", json={"name": "  "}, headers=_auth(token))
    assert res.status_code == 422, res.text
