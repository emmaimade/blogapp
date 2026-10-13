"""
Make an existing account a platform superadmin.

Sign up through the site or studio first, then run from backend/:

    uv run python scripts/create_admin.py you@example.com

Uses DATABASE_URL from .env, so check which database it points at before running.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select  # noqa: E402

from app.core.db import engine  # noqa: E402
from app.models import PlatformRole, User  # noqa: E402


def promote(email: str) -> None:
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user or user.deleted_at is not None:
            sys.exit(f"No active account with email {email}. Sign up first.")

        if user.is_super_admin and user.platform_role == PlatformRole.SUPER_ADMIN:
            print(f"{email} is already a superadmin.")
            return

        user.is_super_admin = True
        user.platform_role = PlatformRole.SUPER_ADMIN
        session.add(user)
        session.commit()
        print(f"{email} is now a superadmin.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/create_admin.py <email>")
    promote(sys.argv[1].strip())
