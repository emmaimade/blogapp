from typing import Optional
from sqlmodel import Session
from app.models import Notification


def add_notification(
    session: Session,
    *,
    user_id: int,
    type: str,
    title: str,
    body: str,
    link: str,
    blog_id: Optional[int] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        blog_id=blog_id,
        type=type,
        title=title,
        body=body,
        link=link,
    )
    session.add(notification)
    return notification