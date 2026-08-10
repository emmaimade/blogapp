from sqlmodel import SQLModel, Session, create_engine

from .config import DATABASE_URL, settings

# SQLite (used by the test suite) hands connections out per-thread by default,
# which breaks as soon as TestClient runs the app off the calling thread.
_connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL and DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(DATABASE_URL, echo=settings.SQL_ECHO, connect_args=_connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
