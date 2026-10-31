"""
Post version history: a version is kept whenever a save changes the article
(title, content or image) or takes the post live, and the newest
MAX_REVISIONS per post are kept. Restoring happens in the editor — it loads an
old version for the author to save, so nothing goes live by itself and the
version it replaced stays in the history.
"""
from typing import Optional

from sqlmodel import Session, select

from app.core.error_codes import ErrorCode
from app.core.exceptions import NotFoundError
from app.models import Post, User
from app.models.revision import PostRevision

MAX_REVISIONS = 30


def record_revision(session: Session, post: Post, user: Optional[User], reason: str) -> None:
    """Add a version of `post` as it is now. Doesn't commit."""
    session.add(PostRevision(
        post_id=post.id,
        title=post.title,
        content=post.content,
        thumbnail_url=post.thumbnail_url,
        saved_by_id=user.id if user else None,
        reason=reason,
    ))
    session.flush()
    stale = session.exec(
        select(PostRevision)
        .where(PostRevision.post_id == post.id)
        .order_by(PostRevision.created_at.desc(), PostRevision.id.desc())
        .offset(MAX_REVISIONS)
    ).all()
    for revision in stale:
        session.delete(revision)


def list_revisions(session: Session, post: Post) -> list[tuple[PostRevision, Optional[User]]]:
    return list(session.exec(
        select(PostRevision, User)
        .join(User, User.id == PostRevision.saved_by_id, isouter=True)
        .where(PostRevision.post_id == post.id)
        .order_by(PostRevision.created_at.desc(), PostRevision.id.desc())
    ).all())


def get_revision(session: Session, post: Post, revision_id: int) -> PostRevision:
    revision = session.get(PostRevision, revision_id)
    if not revision or revision.post_id != post.id:
        raise NotFoundError(ErrorCode.RESOURCE_NOT_FOUND)
    return revision


def belongs_to(session: Session, post_id: int, revision_id: Optional[int]) -> bool:
    if revision_id is None:
        return False
    revision = session.get(PostRevision, revision_id)
    return bool(revision and revision.post_id == post_id)
