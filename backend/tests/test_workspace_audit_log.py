"""
Workspace activity log: the actor and date filters, actor names on rows, and
the /filters endpoint that feeds the "who" filter and the history note.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import AuditLog, SubscriptionPlan

from tests.test_plan_limits import _set_plan


def _register(client, first_name: str = "Ada") -> tuple[dict, int, int, str]:
    email = f"user-{uuid.uuid4().hex[:12]}@example.com"
    resp = client.post(
        "/users/register",
        json={
            "first_name": first_name,
            "last_name": "Lovelace",
            "email": email,
            "password": "correcthorse1",
            "workspace_name": f"Workspace {uuid.uuid4().hex[:6]}",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"], email


def _log(blog_id: int, actor_id: int, name: str, days_ago: float = 0) -> None:
    with Session(engine) as session:
        session.add(
            AuditLog(
                action="tag.created",
                resource_type="tag",
                blog_id=blog_id,
                actor_user_id=actor_id,
                details=f'{{"name": "{name}"}}',
                created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
            )
        )
        session.commit()


def _names(client, blog_id: int, headers: dict, **params) -> set[str]:
    resp = client.get(f"/blogs/{blog_id}/audit-logs", params={"action": "tag.created", **params}, headers=headers)
    assert resp.status_code == 200, resp.text
    return {row["description"] for row in resp.json()}


def _workspace_with_teammate(client):
    owner_headers, blog_id, owner_id, _ = _register(client, "Ada")
    mate_headers, _, mate_id, mate_email = _register(client, "Grace")
    _set_plan(blog_id, SubscriptionPlan.TEAM)
    added = client.post(
        f"/blogs/{blog_id}/members", json={"email": mate_email, "role": "author"}, headers=owner_headers
    )
    assert added.status_code == 201, added.text
    return owner_headers, mate_headers, blog_id, owner_id, mate_id


def test_filters_by_actor(client):
    owner_headers, _, blog_id, owner_id, mate_id = _workspace_with_teammate(client)
    _log(blog_id, owner_id, "by-owner")
    _log(blog_id, mate_id, "by-mate")

    assert _names(client, blog_id, owner_headers, actor_user_id=mate_id) == {'Created tag "by-mate"'}


def test_filters_by_date_range(client):
    headers, blog_id, user_id, _ = _register(client)
    _log(blog_id, user_id, "today")
    _log(blog_id, user_id, "three-days", days_ago=3)
    _log(blog_id, user_id, "six-days", days_ago=6)

    now = datetime.now(timezone.utc)
    assert _names(client, blog_id, headers, since=(now - timedelta(days=1)).isoformat()) == {'Created tag "today"'}
    assert _names(
        client,
        blog_id,
        headers,
        since=(now - timedelta(days=5)).isoformat(),
        until=(now - timedelta(days=1)).isoformat(),
    ) == {'Created tag "three-days"'}


def test_rows_carry_actor_name(client):
    headers, blog_id, user_id, _ = _register(client, "Ada")
    _log(blog_id, user_id, "named")

    rows = client.get(f"/blogs/{blog_id}/audit-logs", params={"action": "tag.created"}, headers=headers).json()
    assert rows[0]["actor_name"] == "Ada Lovelace"


def test_filters_endpoint_lists_actors_and_history(client):
    owner_headers, _, blog_id, owner_id, mate_id = _workspace_with_teammate(client)
    _log(blog_id, owner_id, "older", days_ago=2)
    _log(blog_id, mate_id, "newer")

    resp = client.get(f"/blogs/{blog_id}/audit-logs/filters", headers=owner_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["history_days"] == 365
    # Most recently active first.
    assert [actor["user_id"] for actor in body["actors"]][:2] == [mate_id, owner_id]
    assert body["actors"][0]["name"] == "Grace Lovelace"


def test_filters_endpoint_respects_history_window(client):
    headers, blog_id, _, _ = _register(client)
    _, _, former_id, _ = _register(client, "Grace")
    _log(blog_id, former_id, "too-old", days_ago=30)

    body = client.get(f"/blogs/{blog_id}/audit-logs/filters", headers=headers).json()
    assert body["history_days"] == 7
    assert former_id not in {actor["user_id"] for actor in body["actors"]}


def test_filters_endpoint_is_owner_or_editor_only(client):
    _, mate_headers, blog_id, _, _ = _workspace_with_teammate(client)

    resp = client.get(f"/blogs/{blog_id}/audit-logs/filters", headers=mate_headers)
    assert resp.status_code == 403


def test_settings_changes_name_the_fields_not_the_values(client):
    headers, blog_id, user_id, _ = _register(client)
    with Session(engine) as session:
        session.add(
            AuditLog(
                action="settings.updated",
                resource_type="settings",
                blog_id=blog_id,
                actor_user_id=user_id,
                details='{"key": "seo", "changes": {"meta_title": {"from": "Old", "to": "A very long new title"}}}',
            )
        )
        session.commit()

    rows = client.get(f"/blogs/{blog_id}/audit-logs", params={"action": "settings.updated"}, headers=headers).json()
    assert rows[0]["description"] == "Updated SEO settings: meta title"
    assert rows[0]["details"]["changes"]["meta_title"]["to"] == "A very long new title"
