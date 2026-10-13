"""
Superadmin audit log: search, date range, total count, category/severity
filters, sign-ins hidden by default, the summary counts, the lookup used by
the pickers, CSV export — and that every action the code logs is in the
catalog, so none falls through to "info" unnoticed.

The test database is shared across the suite, so each test scopes its
queries to a workspace (or a unique marker) of its own.
"""

import csv
import io
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlmodel import Session, select

from app.core.audit_catalog import ACTIONS
from app.core.db import engine
from app.models import AuditLog, Blog
from app.models.post import PostStatus
from app.modules.superadmin import audit_router

from tests.test_billing_admin import _register, _superadmin

URL = "/superadmin/audit-logs"


def _log(blog_id, action, *, details=None, days_ago=0.0, ip=None, actor_id=None, actor_email=None):
    with Session(engine) as session:
        session.add(
            AuditLog(
                action=action,
                resource_type=action.split(".")[0],
                blog_id=blog_id,
                actor_user_id=actor_id,
                actor_email=actor_email,
                ip_address=ip,
                details=json.dumps(details) if details is not None else None,
                created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
            )
        )
        session.commit()


def _workspace(client) -> int:
    """A fresh workspace with nothing logged against it but what a test adds."""
    _, blog_id, _, _ = _register(client)
    with Session(engine) as session:
        for row in session.exec(select(AuditLog).where(AuditLog.blog_id == blog_id)).all():
            session.delete(row)
        session.commit()
    return blog_id


def _actions(client, headers, **params) -> list[str]:
    resp = client.get(URL, params={"limit": 200, **params}, headers=headers)
    assert resp.status_code == 200, resp.text
    return [row["action"] for row in resp.json()]


def test_search_matches_details_and_ip(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    marker = uuid.uuid4().hex[:10]
    _log(blog_id, "tag.create", details={"name": f"tag-{marker}"})
    _log(blog_id, "tag.update", ip="10.9.44.7", details={"name": "other"})
    _log(blog_id, "tag.delete", details={"name": "unrelated"})

    assert _actions(client, headers, blog_id=blog_id, search=marker) == ["tag.create"]
    assert _actions(client, headers, blog_id=blog_id, search="10.9.44.") == ["tag.update"]


def test_date_range(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "tag.create", days_ago=0)
    _log(blog_id, "tag.update", days_ago=3)
    _log(blog_id, "tag.delete", days_ago=10)

    now = datetime.now(timezone.utc)
    assert _actions(
        client, headers, blog_id=blog_id,
        since=(now - timedelta(days=5)).isoformat(), until=(now - timedelta(days=1)).isoformat(),
    ) == ["tag.update"]


def test_total_count_header_and_paging(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    for _ in range(5):
        _log(blog_id, "tag.create")

    resp = client.get(URL, params={"blog_id": blog_id, "limit": 2, "skip": 2}, headers=headers)
    assert resp.status_code == 200
    assert resp.headers["X-Total-Count"] == "5"
    assert len(resp.json()) == 2


def _ids(client, headers, **params) -> tuple[list[int], bool, bool]:
    resp = client.get(URL, params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    return (
        [row["id"] for row in resp.json()],
        resp.headers["X-Has-Older"] == "true",
        resp.headers["X-Has-Newer"] == "true",
    )


def _log_at(blog_id, created_at, count=1):
    with Session(engine) as session:
        for _ in range(count):
            session.add(AuditLog(action="tag.create", resource_type="tag", blog_id=blog_id, created_at=created_at))
        session.commit()


def test_cursor_paging_walks_both_ways_without_gaps(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    now = datetime.now(timezone.utc)
    # Three rows sharing one timestamp, so the id tie-break is exercised.
    _log_at(blog_id, now - timedelta(minutes=10))
    _log_at(blog_id, now - timedelta(minutes=5), count=3)
    _log_at(blog_id, now - timedelta(minutes=1))
    everything, _, _ = _ids(client, headers, blog_id=blog_id, limit=200)
    assert len(everything) == 5

    pages = [_ids(client, headers, blog_id=blog_id, limit=2)]
    while pages[-1][1]:
        pages.append(_ids(client, headers, blog_id=blog_id, limit=2, before_id=pages[-1][0][-1]))
    assert [ids for ids, _, _ in pages] == [everything[0:2], everything[2:4], everything[4:5]]
    assert [newer for _, _, newer in pages] == [False, True, True]

    # Back up from the oldest page.
    ids, has_older, has_newer = _ids(client, headers, blog_id=blog_id, limit=2, after_id=everything[4])
    assert (ids, has_older, has_newer) == (everything[2:4], True, True)
    ids, _, has_newer = _ids(client, headers, blog_id=blog_id, limit=2, after_id=everything[2])
    assert (ids, has_newer) == (everything[0:2], False)


def test_cursor_page_does_not_shift_when_new_entries_arrive(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    for minutes in (4, 3, 2, 1):
        _log_at(blog_id, datetime.now(timezone.utc) - timedelta(minutes=minutes))
    first, _, _ = _ids(client, headers, blog_id=blog_id, limit=2)

    _log(blog_id, "tag.update")
    second, has_older, _ = _ids(client, headers, blog_id=blog_id, limit=2, before_id=first[-1])

    assert len(second) == 2 and not set(first) & set(second)
    assert not has_older
    resp = client.get(URL, params={"blog_id": blog_id, "limit": 2, "before_id": first[-1]}, headers=headers)
    assert resp.headers["X-Total-Count"] == "5"


def test_cursor_edge_cases(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "tag.create")

    both = client.get(URL, params={"blog_id": blog_id, "before_id": 1, "after_id": 2}, headers=headers)
    assert both.status_code == 400

    # An unknown cursor reads as the first page.
    ids, has_older, has_newer = _ids(client, headers, blog_id=blog_id, before_id=10**9)
    assert len(ids) == 1 and not has_older and not has_newer


def test_jump_to_a_moment(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    now = datetime.now(timezone.utc)
    for hours in (5, 4, 3, 2, 1):
        _log_at(blog_id, now - timedelta(hours=hours))
    _log(blog_id, "tag.update")  # another action, for the filter check
    everything, _, _ = _ids(client, headers, blog_id=blog_id, action="tag.create", limit=200)

    at = (now - timedelta(hours=2, minutes=30)).isoformat()
    ids, has_older, has_newer = _ids(client, headers, blog_id=blog_id, action="tag.create", at=at, limit=2)
    assert (ids, has_older, has_newer) == (everything[2:4], True, True)

    # The id cursors carry on from a jump.
    ids, has_older, _ = _ids(client, headers, blog_id=blog_id, action="tag.create", before_id=ids[-1], limit=2)
    assert (ids, has_older) == (everything[4:5], False)

    # A moment in the future is the newest page.
    future = (now + timedelta(days=1)).isoformat()
    ids, _, has_newer = _ids(client, headers, blog_id=blog_id, action="tag.create", at=future, limit=2)
    assert (ids, has_newer) == (everything[0:2], False)

    resp = client.get(URL, params={"blog_id": blog_id, "at": at, "before_id": 1}, headers=headers)
    assert resp.status_code == 400


def test_single_entry(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "tag.create", ip="10.1.2.3")
    (entry_id,), _, _ = _ids(client, headers, blog_id=blog_id)

    resp = client.get(f"{URL}/{entry_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["id"], body["action"], body["ip_address"], body["blog_id"]) == (entry_id, "tag.create", "10.1.2.3", blog_id)
    assert body["label"] and body["severity"]

    assert client.get(f"{URL}/{10**9}", headers=headers).status_code == 404


def test_sign_ins_hidden_unless_asked_for(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _, _, actor_id, _ = _register(client)
    _log(blog_id, "user.login", actor_id=actor_id)
    _log(blog_id, "tag.create", actor_id=actor_id)

    assert _actions(client, headers, blog_id=blog_id) == ["tag.create"]
    assert sorted(_actions(client, headers, blog_id=blog_id, include_logins=True)) == ["tag.create", "user.login"]
    # Looking at one person includes their sign-ins.
    assert sorted(_actions(client, headers, blog_id=blog_id, actor_user_id=actor_id)) == ["tag.create", "user.login"]
    assert _actions(client, headers, blog_id=blog_id, action="user.login") == ["user.login"]


def test_category_and_severity_filter_on_the_server(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "superadmin.force_temporary_password")  # auth, critical
    _log(blog_id, "billing.payment_failed")  # billing, warning
    _log(blog_id, "tag.create")  # content, info
    _log(blog_id, "legacy.something_old")  # not in the catalog: other, info

    assert _actions(client, headers, blog_id=blog_id, severity="critical") == ["superadmin.force_temporary_password"]
    assert _actions(client, headers, blog_id=blog_id, category="billing") == ["billing.payment_failed"]
    assert _actions(client, headers, blog_id=blog_id, category="other") == ["legacy.something_old"]
    assert sorted(_actions(client, headers, blog_id=blog_id, severity="info")) == ["legacy.something_old", "tag.create"]

    row = client.get(URL, params={"blog_id": blog_id, "severity": "critical"}, headers=headers).json()[0]
    assert (row["label"], row["category"], row["severity"]) == ("Superadmin forced a temporary password", "auth", "critical")


def test_summary_counts_ignore_the_severity_filter(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "superadmin.user_delete")
    _log(blog_id, "post.deleted")
    _log(blog_id, "post.deleted")
    _log(blog_id, "tag.create")
    _log(blog_id, "user.login")  # hidden by default, so not counted

    resp = client.get(f"{URL}/summary", params={"blog_id": blog_id, "severity": "critical"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"total": 4, "by_severity": {"critical": 1, "warning": 2, "info": 1}}


def test_lookup_finds_workspaces_and_users(client):
    headers = _superadmin(client)
    _, blog_id, user_id, email = _register(client)
    with Session(engine) as session:
        workspace_name = session.get(Blog, blog_id).name

    by_name = client.get(f"{URL}/lookup", params={"q": workspace_name}, headers=headers).json()
    assert blog_id in [w["id"] for w in by_name["workspaces"]]

    by_email = client.get(f"{URL}/lookup", params={"q": email[:14]}, headers=headers).json()
    assert [u["id"] for u in by_email["users"]] == [user_id]
    assert by_email["users"][0]["name"] == "Ada Lovelace"

    only_users = client.get(f"{URL}/lookup", params={"q": email[:14], "kind": "user"}, headers=headers).json()
    assert only_users["workspaces"] == [] and [u["id"] for u in only_users["users"]] == [user_id]

    by_id = client.get(f"{URL}/lookup", params={"user_id": user_id, "blog_id": blog_id}, headers=headers).json()
    assert [u["id"] for u in by_id["users"]] == [user_id]
    assert [w["id"] for w in by_id["workspaces"]] == [blog_id]


def test_export_respects_filters_and_is_itself_logged(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "tag.create", details={"name": "safe"}, actor_email="=HYPERLINK(1)@example.com")
    _log(blog_id, "post.deleted", details={"title": "Gone"})

    resp = client.get(f"{URL}/export", params={"blog_id": blog_id, "category": "content", "severity": "info"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/csv")
    assert resp.headers["X-Export-Truncated"] == "false"

    rows = list(csv.DictReader(io.StringIO(resp.text)))
    assert [row["action"] for row in rows] == ["tag.create"]
    assert rows[0]["severity"] == "info"
    assert rows[0]["description"] == 'Created tag "safe"'
    # A formula in user-supplied text is neutralised, not run by a spreadsheet.
    assert rows[0]["actor_email"] == "'=HYPERLINK(1)@example.com"

    exports = _actions(client, headers, action="superadmin.audit_log_export", limit=200)
    assert exports, "the export should be in the audit log"


def test_export_neutralises_formulas():
    assert audit_router._csv_safe("=1+1") == "'=1+1"
    assert audit_router._csv_safe("@SUM(A1)") == "'@SUM(A1)"
    assert audit_router._csv_safe("plain") == "plain"
    assert audit_router._csv_safe(None) == ""


def test_export_says_when_it_was_cut_short(client, monkeypatch):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    for _ in range(3):
        _log(blog_id, "tag.create")
    monkeypatch.setattr(audit_router, "EXPORT_LIMIT", 2)

    resp = client.get(f"{URL}/export", params={"blog_id": blog_id}, headers=headers)
    assert resp.headers["X-Export-Truncated"] == "true"
    assert len(list(csv.DictReader(io.StringIO(resp.text)))) == 2


@pytest.mark.parametrize("path", ["", "/summary", "/lookup", "/export", "/1"])
def test_superadmin_only(client, path):
    headers, _, _, _ = _register(client)
    assert client.get(f"{URL}{path}", headers=headers).status_code == 403


def test_status_changes_read_as_sentences(client):
    headers = _superadmin(client)
    blog_id = _workspace(client)
    _log(blog_id, "superadmin.blog_status_update", details={"from": True, "to": False})

    _log(blog_id, "superadmin.user_status_update", details={"is_active": True}, days_ago=1)  # older shape

    rows = client.get(URL, params={"blog_id": blog_id}, headers=headers).json()
    assert [row["description"] for row in rows] == ["Deactivated a workspace", "Reactivated a user account"]


# ── Catalog coverage ─────────────────────────────────────────────────────────

APP_DIR = Path(__file__).resolve().parents[1] / "app"

# Actions built at runtime, and every value they can take.
DYNAMIC_ACTIONS = {
    'f"http.{request.method.lower()}"': [],  # middleware noise, never shown
    'f"moderation.{action}"': ["moderation.approve", "moderation.reject", "moderation.remove"],
    'f"post.{resolved_status.value}"': [f"post.{status.value}" for status in PostStatus],
}


def _logged_actions() -> tuple[set[str], set[str]]:
    literals: set[str] = set()
    dynamic: set[str] = set()
    for path in APP_DIR.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        literals |= set(re.findall(r'\baction="([a-z_]+\.[a-z_]+)"', source))
        dynamic |= set(re.findall(r'\baction=(f"[^"]+")', source))
    return literals, dynamic


def test_every_logged_action_is_in_the_catalog():
    literals, dynamic = _logged_actions()
    assert literals, "the scan should find the logged actions"

    unknown_dynamic = dynamic - set(DYNAMIC_ACTIONS)
    assert not unknown_dynamic, f"New runtime-built actions; list their values in DYNAMIC_ACTIONS: {unknown_dynamic}"

    expanded = literals | {action for values in DYNAMIC_ACTIONS.values() for action in values}
    missing = sorted(action for action in expanded if action not in ACTIONS)
    assert not missing, f"Add these to app/core/audit_catalog.py: {missing}"
