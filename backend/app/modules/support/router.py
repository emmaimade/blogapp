from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, BadRequestError, NotFoundError, ValidationError
from app.core.permissions import Permissions
from app.core.security import get_current_user
from app.core.email import dispatch_email
from app.core.email_templates import get_new_support_ticket_admin_template, get_new_support_ticket_admin_template_text
from app.core.notifications import add_notification
from app.models import SupportTicket, SupportMessage, TicketStatus, User
from app.models.support import utcnow

router = APIRouter(prefix="/support", tags=["Support"])


class CreateTicketSchema(BaseModel):
    subject: str
    body: str
    blog_id: Optional[int] = None


class CreateMessageSchema(BaseModel):
    body: str


class SupportMessageRead(BaseModel):
    id: int
    sender_id: int
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class SupportTicketRead(BaseModel):
    id: int
    user_id: int
    blog_id: Optional[int]
    blog_name: Optional[str] = None
    user_name: Optional[str] = None
    subject: str
    status: TicketStatus
    created_at: datetime
    updated_at: datetime
    messages: List[SupportMessageRead] = []

    class Config:
        from_attributes = True


def _notify_admins_of_new_ticket(session: Session, background_tasks: BackgroundTasks, ticket: SupportTicket, creator: User, first_message_body: str):
    admins = session.exec(
        select(User).where((User.is_super_admin == True) | (User.platform_role == "super_admin"))
    ).all()
    for admin in admins:
        email_html = get_new_support_ticket_admin_template(admin.first_name, creator.email, ticket.subject, first_message_body)
        email_text = get_new_support_ticket_admin_template_text(admin.first_name, creator.email, ticket.subject, first_message_body)
        dispatch_email(background_tasks, admin.email, f"New support ticket: {ticket.subject}", email_html, email_text)

        add_notification(
            session,
            user_id=admin.id,
            type="support_ticket_created",
            title="New support ticket",
            body=f'"{ticket.subject}" from {creator.email}',
            link=f"/admin/support?ticket={ticket.id}",
        )
    session.commit()


@router.post("/", response_model=SupportTicketRead, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: CreateTicketSchema,
    background_tasks: BackgroundTasks,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    field_errors = {}
    if not payload.subject.strip():
        field_errors["subject"] = "This field is required."
    if not payload.body.strip():
        field_errors["body"] = "This field is required."
    if field_errors:
        raise ValidationError(errors=field_errors)

    if payload.blog_id is not None and not Permissions.can_access_blog(current_user, payload.blog_id, session):
        raise AuthorizationError(
            ErrorCode.FORBIDDEN,
            "You don't have access to that workspace.",
        )

    ticket = SupportTicket(
        user_id=current_user.id,
        blog_id=payload.blog_id,
        subject=payload.subject.strip(),
    )
    session.add(ticket)
    session.flush()

    message = SupportMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        body=payload.body.strip(),
    )
    session.add(message)

    add_audit_log(
        session,
        action="support.ticket_created",
        resource_type="support_ticket",
        resource_id=ticket.id,
        blog_id=payload.blog_id,
        actor=current_user,
        details={"subject": ticket.subject},
        request=request,
    )
    session.commit()
    session.refresh(ticket)

    _notify_admins_of_new_ticket(session, background_tasks, ticket, current_user, message.body)

    return ticket


@router.get("/", response_model=List[SupportTicketRead])
def list_my_tickets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(
        select(SupportTicket)
        .where(SupportTicket.user_id == current_user.id)
        .order_by(SupportTicket.updated_at.desc())
    ).all()


@router.get("/{ticket_id}", response_model=SupportTicketRead)
def get_ticket(
    ticket_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket:
        raise NotFoundError(ErrorCode.TICKET_NOT_FOUND)

    is_owner = ticket.user_id == current_user.id
    is_superadmin = current_user.is_super_admin or current_user.platform_role == "super_admin"
    if not is_owner and not is_superadmin:
        raise AuthorizationError(
            ErrorCode.FORBIDDEN,
            "You don't have permission to view this ticket.",
        )

    return ticket


@router.post("/{ticket_id}/messages", response_model=SupportMessageRead, status_code=status.HTTP_201_CREATED)
def reply_to_ticket(
    ticket_id: int,
    payload: CreateMessageSchema,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket:
        raise NotFoundError(ErrorCode.TICKET_NOT_FOUND)

    is_owner = ticket.user_id == current_user.id
    is_superadmin = current_user.is_super_admin or current_user.platform_role == "super_admin"
    if not is_owner and not is_superadmin:
        raise AuthorizationError(
            ErrorCode.FORBIDDEN,
            "You don't have permission to reply to this ticket.",
        )

    if ticket.status == TicketStatus.CLOSED:
        raise BadRequestError(
            ErrorCode.OPERATION_NOT_ALLOWED,
            "This ticket is closed and can no longer receive replies.",
        )

    if not payload.body.strip():
        raise ValidationError(errors={"body": "This field is required."})

    message = SupportMessage(ticket_id=ticket.id, sender_id=current_user.id, body=payload.body.strip())
    session.add(message)

    if is_owner and ticket.status == TicketStatus.RESOLVED:
        ticket.status = TicketStatus.OPEN

    # Touch updated_at on every reply (not just status changes) so ticket
    # lists sorted by updated_at surface the most recently active threads.
    ticket.updated_at = utcnow()
    session.add(ticket)

    if is_owner:
        # Owner replied — notify all superadmins, same audience as ticket creation
        admins = session.exec(
            select(User).where((User.is_super_admin == True) | (User.platform_role == "super_admin"))
        ).all()
        for admin in admins:
            add_notification(
                session,
                user_id=admin.id,
                type="support_ticket_replied",
                title="New reply on support ticket",
                body=f'"{ticket.subject}" — reply from {current_user.email}',
                link=f"/admin/support?ticket={ticket.id}",
            )
    else:
        # Superadmin replied — notify the ticket owner
        add_notification(
            session,
            user_id=ticket.user_id,
            type="support_ticket_replied",
            title="Your support ticket got a reply",
            body=f'"{ticket.subject}"',
            link=f"/admin/support-tickets?ticket={ticket.id}",
        )

    add_audit_log(
        session,
        action="support.message_sent",
        resource_type="support_ticket",
        resource_id=ticket.id,
        actor=current_user,
        request=request,
    )
    session.commit()
    session.refresh(message)
    return message