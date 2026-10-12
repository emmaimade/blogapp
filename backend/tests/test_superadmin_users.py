"""
/superadmin/users: server-side search, status buckets with counts, workspace
filter and pagination; delete/suspend guards; restoring a soft-deleted account.

The test database is shared across tests, so every test scopes its listing
with a unique search token.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import User


def _register(client, *, first_name="Ada", last_name="Lovelace", email=None) -> tuple[dict, int, int, str]:
    email = email or f"user-{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        "/users/register",
        json={
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"], email


def _superadmin(client) -> tuple[dict, int]:
    headers, _, user_id, _ = _register(client)
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.is_super_admin = True
        session.add(user)
        session.commit()
    return headers, user_id


def _token() -> str:
    return f"zq{uuid.uuid4().hex[:10]}"


def _list(client, admin, **params) -> dict:
    res = client.get("/superadmin/users", headers=admin, params=params)
    assert res.status_code == 200, res.text
    return res.json()


def test_search_matches_full_name_and_counts_every_status(client):
    token = _token()
    ids = [_register(client, first_name="Grace", last_name=f"{token}{i}")[2] for i in range(4)]
    admin, _ = _superadmin(client)

    assert client.patch(f"/superadmin/users/{ids[0]}", headers=admin, json={"is_active": False}).status_code == 200
    assert client.delete(f"/superadmin/users/{ids[1]}", headers=admin).status_code == 204

    # "Grace zq…" only matches across first + last name.
    page = _list(client, admin, search=f"Grace {token}")
    assert page["counts"] == {"all": 3, "active": 2, "suspended": 1, "deleted": 1}
    assert page["total"] == 3
    assert {u["id"] for u in page["items"]} == {ids[0], ids[2], ids[3]}

    deleted = _list(client, admin, search=token, status="deleted")
    assert [u["id"] for u in deleted["items"]] == [ids[1]]
    suspended = _list(client, admin, search=token, status="suspended")
    assert [u["id"] for u in suspended["items"]] == [ids[0]]


def test_pagination_reports_total_and_has_more(client):
    token = _token()
    for i in range(5):
        _register(client, last_name=f"{token}{i}")
    admin, _ = _superadmin(client)

    first = _list(client, admin, search=token, limit=2)
    assert (first["total"], len(first["items"]), first["has_more"]) == (5, 2, True)
    last = _list(client, admin, search=token, skip=4, limit=2)
    assert (len(last["items"]), last["has_more"]) == (1, False)


def test_workspace_filter_lists_only_that_workspaces_members(client):
    token = _token()
    _, blog_id, member_id, _ = _register(client, last_name=f"{token}a")
    _register(client, last_name=f"{token}b")
    admin, _ = _superadmin(client)

    page = _list(client, admin, search=token, blog_id=blog_id)
    assert [u["id"] for u in page["items"]] == [member_id]
    assert page["counts"]["all"] == 1


def test_deleted_accounts_cannot_be_deleted_again_or_suspended(client):
    _, _, user_id, _ = _register(client)
    admin, _ = _superadmin(client)
    assert client.delete(f"/superadmin/users/{user_id}", headers=admin).status_code == 204

    again = client.delete(f"/superadmin/users/{user_id}", headers=admin)
    assert again.status_code == 400
    assert "already deleted" in again.json()["message"]
    status = client.patch(f"/superadmin/users/{user_id}", headers=admin, json={"is_active": True})
    assert status.status_code == 400


def test_superadmin_cannot_suspend_themselves(client):
    admin, admin_id = _superadmin(client)
    res = client.patch(f"/superadmin/users/{admin_id}", headers=admin, json={"is_active": False})
    assert res.status_code == 400


def test_restore_brings_back_the_original_identity(client):
    _, _, user_id, email = _register(client)
    admin, _ = _superadmin(client)
    with Session(engine) as session:
        username = session.get(User, user_id).username

    assert client.delete(f"/superadmin/users/{user_id}", headers=admin).status_code == 204
    res = client.post(f"/superadmin/users/{user_id}/restore", headers=admin)
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["email"], body["username"]) == (email, username)
    assert body["deleted_at"] is None and body["is_active"] is True

    # Restoring a live account is refused.
    assert client.post(f"/superadmin/users/{user_id}/restore", headers=admin).status_code == 400


def test_restore_refuses_when_the_email_was_taken_since(client):
    _, _, user_id, email = _register(client)
    admin, _ = _superadmin(client)
    assert client.delete(f"/superadmin/users/{user_id}", headers=admin).status_code == 204

    # The delete freed the address; someone signs up with it.
    client.cookies.clear()
    _register(client, email=email)

    res = client.post(f"/superadmin/users/{user_id}/restore", headers=admin)
    assert res.status_code == 409
    assert email in res.json()["message"]
