"""
Onboarding: four steps (about → profile → publication → plan), and launching
needs a verified email. Inviting the team happens after launch, once the plan
the owner picked is in force — a fresh workspace is on Free, which has no
spare seats.
"""

import uuid

from sqlmodel import Session

from app.core.db import engine
from app.core.security import ACCESS_TOKEN_COOKIE_NAME
from app.models import Blog, User
from app.models.blog import OnboardingStatus, OnboardingStep


def _register(client) -> tuple[dict, int, int]:
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
    body = resp.json()
    headers = {"Authorization": f"Bearer {client.cookies.get(ACCESS_TOKEN_COOKIE_NAME)}"}
    return headers, body["user"]["blog_memberships"][0]["blog_id"], body["user"]["id"]


def _verify(user_id: int) -> None:
    with Session(engine) as session:
        user = session.get(User, user_id)
        user.email_verified = True
        session.add(user)
        session.commit()


def _complete_setup_steps(client, headers: dict, blog_id: int) -> dict:
    about = client.put(
        f"/blogs/{blog_id}/onboarding/about",
        json={"owner_role": "blogger", "workspace_type": "personal_blog", "team_size": "solo"},
        headers=headers,
    )
    assert about.status_code == 200, about.text
    profile = client.put(
        f"/blogs/{blog_id}/onboarding/profile",
        json={
            "name": "Field Notes",
            "tagline": "Notes from the field",
            "description": "",
            "category": "Tech",
            "primary_language": "en",
        },
        headers=headers,
    )
    assert profile.status_code == 200, profile.text
    publication = client.put(
        f"/blogs/{blog_id}/onboarding/publication",
        json={"default_post_visibility": "public", "comments_enabled": True, "posts_per_page": 10, "timezone": "UTC"},
        headers=headers,
    )
    assert publication.status_code == 200, publication.text
    return publication.json()["summary"]


def test_onboarding_has_four_steps_with_no_team_step(client):
    headers, blog_id, _ = _register(client)

    summary = client.get(f"/blogs/{blog_id}/onboarding", headers=headers).json()["summary"]

    assert summary["total_steps"] == 4
    assert set(summary["checklist"]) == {"about", "profile", "publication", "plan"}


def test_publication_step_leads_straight_to_plan(client):
    headers, blog_id, _ = _register(client)

    summary = _complete_setup_steps(client, headers, blog_id)

    assert summary["current_step"] == "plan"
    assert summary["completed_steps"] == 3
    assert summary["percent_complete"] == 75


def test_verified_owner_can_launch(client):
    headers, blog_id, user_id = _register(client)
    _verify(user_id)
    _complete_setup_steps(client, headers, blog_id)

    resp = client.put(f"/blogs/{blog_id}/onboarding/plan", json={"plan": "free"}, headers=headers)

    assert resp.status_code == 200, resp.text
    summary = resp.json()["summary"]
    assert summary["status"] == "completed"
    assert summary["completed_steps"] == summary["total_steps"] == 4


def test_unverified_owner_cannot_launch(client):
    headers, blog_id, _ = _register(client)
    _complete_setup_steps(client, headers, blog_id)

    resp = client.put(f"/blogs/{blog_id}/onboarding/plan", json={"plan": "free"}, headers=headers)

    assert resp.status_code == 403, resp.text
    assert resp.json()["code"] == "EMAIL_NOT_VERIFIED"
    with Session(engine) as session:
        assert session.get(Blog, blog_id).onboarding_status != OnboardingStatus.COMPLETED


def test_workspace_left_on_the_old_team_step_resumes_at_plan(client):
    headers, blog_id, _ = _register(client)
    _complete_setup_steps(client, headers, blog_id)
    with Session(engine) as session:
        blog = session.get(Blog, blog_id)
        blog.onboarding_step = OnboardingStep.TEAM
        session.add(blog)
        session.commit()

    summary = client.get(f"/blogs/{blog_id}/onboarding", headers=headers).json()["summary"]

    assert summary["current_step"] == "plan"


def test_team_step_endpoint_is_gone(client):
    headers, blog_id, _ = _register(client)

    resp = client.post(f"/blogs/{blog_id}/onboarding/team/complete", json={"skipped": True}, headers=headers)

    assert resp.status_code in (404, 405)
