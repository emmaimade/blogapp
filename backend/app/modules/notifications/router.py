from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from datetime import datetime, timezone

from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import NotFoundError
from app.core.security import get_current_user
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def list_notifications(
    limit: int = 30,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    ).all()


@router.get("/unread-count")
def get_unread_count(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    count = session.exec(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at == None)
    ).one()
    return {"count": count}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    notification = session.get(Notification, notification_id)
    # Someone else's notification is reported as missing rather than
    # forbidden, so IDs can't be probed for existence.
    if not notification or notification.user_id != current_user.id:
        raise NotFoundError(ErrorCode.NOTIFICATION_NOT_FOUND)

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        session.add(notification)
        session.commit()

    return {"message": "Marked as read"}


@router.post("/read-all")
def mark_all_read(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    unread = session.exec(
        select(Notification).where(Notification.user_id == current_user.id, Notification.read_at == None)
    ).all()
    now = datetime.now(timezone.utc)
    for n in unread:
        n.read_at = now
        session.add(n)
    session.commit()
    return {"message": f"Marked {len(unread)} notification(s) as read"}