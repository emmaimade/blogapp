"""
Coverage for settings/router.py's upload_branding_asset (used by both the
logo and favicon upload routes) — content-type validation already existed,
size validation is new.
"""

import importlib
import io

from app.core.config import settings
from app.core.exceptions import BadRequestError

# `app.modules.settings.router` (the attribute) is shadowed by the package's
# own `__init__.py` doing `from .router import router` — that rebinds the
# package's `router` name to the APIRouter *instance*, not the submodule. A
# straight `import app.modules.settings.router as X` resolves via that same
# shadowed attribute (per the import statement's `X = a.b.c` semantics), so
# it needs to go through sys.modules instead to reach the actual module.
settings_router = importlib.import_module("app.modules.settings.router")


class _FakeUploadFile:
    def __init__(self, content_type, file_obj, size=None):
        self.content_type = content_type
        self.file = file_obj
        self.size = size if size is not None else len(file_obj.getvalue())


def test_upload_branding_asset_rejects_disallowed_content_type():
    fake_file = _FakeUploadFile("application/pdf", io.BytesIO(b"not an image"))
    try:
        settings_router.upload_branding_asset(fake_file, "branding_logos", ("image/png", "image/jpeg"))
        assert False, "expected BadRequestError"
    except BadRequestError as exc:
        assert exc.code == "INVALID_FILE_TYPE"


def test_upload_branding_asset_rejects_oversized_file():
    oversized = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1
    fake_file = _FakeUploadFile("image/png", io.BytesIO(b""), size=oversized)
    try:
        settings_router.upload_branding_asset(fake_file, "branding_logos", ("image/png",))
        assert False, "expected BadRequestError"
    except BadRequestError as exc:
        assert exc.code == "FILE_TOO_LARGE"


def test_upload_branding_asset_success_returns_secure_url(monkeypatch):
    monkeypatch.setattr(
        settings_router.cloudinary.uploader,
        "upload",
        lambda file, folder=None, resource_type=None: {"secure_url": "https://res.cloudinary.com/fake/logo.png"},
    )
    fake_file = _FakeUploadFile("image/png", io.BytesIO(b"fake image bytes"))
    result = settings_router.upload_branding_asset(fake_file, "branding_logos", ("image/png",))
    assert result == {"url": "https://res.cloudinary.com/fake/logo.png"}
