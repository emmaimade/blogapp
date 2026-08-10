"""
Test fixtures.

The environment is pinned to a throwaway SQLite file *before* `app` is imported
— `app.core.db` builds its engine at module import, and the real `.env` points
at the shared Supabase instance. Environment variables win over `.env` in
pydantic-settings, so setting them here is enough.
"""

import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.gettempdir()) / "inko_error_handling_tests.db"

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["SQL_ECHO"] = "false"
os.environ["LOG_LEVEL"] = "CRITICAL"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-in-production")
os.environ.setdefault("ALGORITHM", "HS256")
# Required settings with no default — stubbed so the suite never needs real
# credentials, and never reaches the real upload provider.
os.environ.setdefault("CLOUDINARY_NAME", "test-cloud")
os.environ.setdefault("CLOUDINARY_API_KEY", "test-key")
os.environ.setdefault("CLOUDINARY_API_SECRET", "test-secret")
os.environ.setdefault("SMTP_HOST", "localhost")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.db import create_db_and_tables, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database():
    create_db_and_tables()
    yield
    engine.dispose()
    _TEST_DB.unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def _no_outbound_email(monkeypatch):
    """
    Neutralise SMTP.

    `dispatch_email` resolves `send_smtp_email` from the module globals when the
    background task runs, so patching the attribute is enough. Without this the
    suite would open real sockets to the configured mail host.
    """
    monkeypatch.setattr("app.core.email.send_smtp_email", lambda *a, **kw: None)


@pytest.fixture()
def client():
    """
    TestClient that surfaces 500s as responses rather than re-raising.

    `raise_server_exceptions=False` is the whole point of these tests: it is
    what lets us assert on the *body* an unexpected exception produces, which
    is where a leak would show up.
    """
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
