"""
POST /blogs/ — creating an additional workspace for a signed-in user. The
address (slug + subdomain) is optional: derived from the name when missing,
validated and never silently renamed when the user chose one.
"""

import uuid

from app.core.security import ACCESS_TOKEN_COOKIE_NAME


def _register(client) -> dict:
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
    return {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}


def test_create_blog_derives_address_from_name_when_missing(client):
    headers = _register(client)
    name = f"Second Blog {uuid.uuid4().hex[:6]}"

    res = client.post("/blogs/", json={"name": name}, headers=headers)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["slug"] == body["subdomain"]
    assert body["slug"].startswith("second-blog-")


def test_create_blog_dedupes_a_derived_address(client):
    headers = _register(client)
    name = f"Same Name {uuid.uuid4().hex[:6]}"

    first = client.post("/blogs/", json={"name": name}, headers=headers)
    second = client.post("/blogs/", json={"name": name}, headers=headers)

    assert first.status_code == 200 and second.status_code == 200
    assert second.json()["slug"] == f"{first.json()['slug']}-1"


def test_create_blog_slugifies_a_requested_address(client):
    headers = _register(client)
    requested = f"My Space {uuid.uuid4().hex[:6]}"

    res = client.post("/blogs/", json={"name": "Anything", "slug": requested}, headers=headers)

    assert res.status_code == 200, res.text
    assert res.json()["subdomain"] == requested.lower().replace(" ", "-")


def test_create_blog_rejects_a_taken_requested_address(client):
    headers = _register(client)
    address = f"taken-{uuid.uuid4().hex[:6]}"
    assert client.post("/blogs/", json={"name": "One", "slug": address}, headers=headers).status_code == 200

    res = client.post("/blogs/", json={"name": "Two", "subdomain": address}, headers=headers)

    assert res.status_code == 409, res.text
    assert res.json()["code"] == "SLUG_ALREADY_EXISTS"


def test_create_blog_rejects_a_blank_name(client):
    headers = _register(client)

    res = client.post("/blogs/", json={"name": "   "}, headers=headers)

    assert res.status_code == 400, res.text


def test_create_blog_makes_the_creator_owner(client):
    headers = _register(client)

    blog_id = client.post("/blogs/", json={"name": "Owned"}, headers=headers).json()["id"]
    me = client.get("/auth/me", headers=headers).json()

    membership = next(m for m in me["blog_memberships"] if m["blog_id"] == blog_id)
    assert membership["role"] == "owner"
