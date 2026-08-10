"""
Post endpoint smoke tests.

These previously called `/posts/`, a route that no longer exists — posts became
workspace-scoped (`/blogs/{blog_id}/posts`) and every assertion in here was
failing against a 404. Updated to the current routes, and extended to cover the
error envelope on the paths they touch.
"""


def test_root_health(client):
    res = client.get("/")
    assert res.status_code == 200
    assert isinstance(res.json(), dict)
    assert res.json().get("status") is not None


def test_posts_are_scoped_to_a_workspace(client):
    """The unscoped collection route is gone; asking for it is a clean 404."""
    res = client.get("/posts/")
    assert res.status_code == 404
    assert res.json()["code"] == "RESOURCE_NOT_FOUND"


def test_listing_posts_for_an_unknown_workspace_is_a_typed_404(client):
    res = client.get("/blogs/98765432/posts/")
    assert res.status_code == 404
    payload = res.json()
    assert payload["success"] is False
    assert payload["code"] == "BLOG_NOT_FOUND"


def test_posts_filter_param_is_accepted(client):
    """`?filter=projects` must not change the failure mode of the route."""
    without = client.get("/blogs/98765432/posts/")
    with_filter = client.get("/blogs/98765432/posts/?filter=projects")
    assert with_filter.status_code == without.status_code
    assert with_filter.json()["code"] == without.json()["code"]


def test_uploading_a_post_image_requires_authentication(client):
    res = client.post("/blogs/1/posts/upload-image")
    assert res.status_code == 401
    assert res.json()["code"] == "AUTHENTICATION_REQUIRED"
