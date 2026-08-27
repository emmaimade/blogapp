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


# ── upload_post_image service-layer coverage ────────────────────────────────
#
# The HTTP route additionally requires completed onboarding (require_blog_owner
# + require_completed_onboarding), so driving these cases through the router
# would mean onboarding a whole workspace first just to reach a function that
# doesn't touch the database at all. Testing the service function directly
# exercises the exact logic these gaps are about (content-type validation,
# Cloudinary success/failure handling) without that unrelated setup.

class _FakeUploadFile:
    def __init__(self, content_type, file_obj, size=None):
        self.content_type = content_type
        self.file = file_obj
        # Real UploadFile.size is populated by Starlette during multipart
        # parsing; a fake stands in for that here rather than a live upload.
        self.size = size if size is not None else len(file_obj.getvalue())


def test_upload_post_image_rejects_non_image_content_type():
    import io
    from app.core.exceptions import BadRequestError
    from app.modules.posts.service import upload_post_image

    fake_file = _FakeUploadFile("application/pdf", io.BytesIO(b"not an image"))
    try:
        upload_post_image(fake_file)
        assert False, "expected BadRequestError"
    except BadRequestError as exc:
        assert exc.code == "INVALID_FILE_TYPE"


def test_upload_post_image_rejects_oversized_file():
    import io
    from app.core.exceptions import BadRequestError
    from app.core.config import settings
    from app.modules.posts.service import upload_post_image

    oversized_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1
    # A fake with a real byte count would be wasteful to actually allocate —
    # the function only ever reads `.size`, so the fake overrides it directly.
    fake_file = _FakeUploadFile("image/png", io.BytesIO(b""), size=oversized_bytes)
    try:
        upload_post_image(fake_file)
        assert False, "expected BadRequestError"
    except BadRequestError as exc:
        assert exc.code == "FILE_TOO_LARGE"


def test_upload_post_image_success_returns_secure_url(monkeypatch):
    import io
    from app.modules.posts import service as post_service

    monkeypatch.setattr(
        post_service.cloudinary.uploader,
        "upload",
        lambda file, folder=None: {"secure_url": "https://res.cloudinary.com/fake/image.png"},
    )

    fake_file = _FakeUploadFile("image/png", io.BytesIO(b"fake image bytes"))
    result = post_service.upload_post_image(fake_file)
    assert result == {"url": "https://res.cloudinary.com/fake/image.png"}


def test_upload_post_image_wraps_cloudinary_failure(monkeypatch):
    import io
    from app.core.exceptions import ExternalServiceError
    from app.modules.posts import service as post_service

    def _boom(file, folder=None):
        raise RuntimeError("cloudinary is down")

    monkeypatch.setattr(post_service.cloudinary.uploader, "upload", _boom)

    fake_file = _FakeUploadFile("image/jpeg", io.BytesIO(b"fake image bytes"))
    try:
        post_service.upload_post_image(fake_file)
        assert False, "expected ExternalServiceError"
    except ExternalServiceError as exc:
        assert exc.code == "UPLOAD_FAILED"
