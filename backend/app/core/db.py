from sqlmodel import SQLModel, Session, create_engine

from .config import DATABASE_URL, settings

# SQLite (used by the test suite) hands connections out per-thread by default,
# which breaks as soon as TestClient runs the app off the calling thread.
_connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL and DATABASE_URL.startswith("sqlite")
    else {}
)

_is_sqlite = bool(DATABASE_URL and DATABASE_URL.startswith("sqlite"))

# The database is remote, so opening a connection is very slow (seconds) and
# every query pays a full network round trip. Keep warm connections around and
# replace them before the server-side pooler drops them for idling — a dropped
# connection would otherwise surface as a slow reconnect or a failed request.
# pool_pre_ping is deliberately off: it costs an extra round trip on every
# request, which is exactly what we're trying to avoid.
_pool_args = {} if _is_sqlite else {"pool_recycle": 240, "pool_use_lifo": True}

engine = create_engine(DATABASE_URL, echo=settings.SQL_ECHO, connect_args=_connect_args, **_pool_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
