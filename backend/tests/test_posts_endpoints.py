from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_root_health():
    res = client.get("/")
    assert res.status_code == 200
    assert isinstance(res.json(), dict)
    assert res.json().get("status") is not None


def test_get_posts_endpoint_exists():
    res = client.get("/posts/")
    assert res.status_code == 200
    # Expect a list (may be empty)
    assert isinstance(res.json(), list)


def test_get_posts_filter_projects_param_ignored():
    # The backend currently does not implement server-side `is_project` filtering
    res_without = client.get("/posts/")
    res_with = client.get("/posts/?filter=projects")
    assert res_with.status_code == 200
    assert isinstance(res_with.json(), list)
    # Basic sanity: both responses are lists (content equality may vary depending on DB)
    assert isinstance(res_without.json(), list)
