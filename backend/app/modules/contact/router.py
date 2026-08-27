from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.config import settings
from app.core.email import dispatch_email
from app.core.email_templates import get_contact_message_template, get_contact_message_template_text

router = APIRouter(prefix="/contact", tags=["Contact"])


class PlatformContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    subject: str
    message: str


@router.post("/", status_code=202)
def send_platform_contact_message(payload: PlatformContactMessageCreate, background_tasks: BackgroundTasks):
    recipient = settings.CONTACT_NOTIFICATION_EMAIL or settings.EMAILS_FROM_EMAIL
    email_html = get_contact_message_template(
        recipient_label=settings.EMAILS_FROM_NAME,
        sender_name=payload.name,
        sender_email=payload.email,
        subject=payload.subject,
        message=payload.message,
        company=payload.company,
    )
    email_text = get_contact_message_template_text(
        recipient_label=settings.EMAILS_FROM_NAME,
        sender_name=payload.name,
        sender_email=payload.email,
        subject=payload.subject,
        message=payload.message,
        company=payload.company,
    )
    dispatch_email(background_tasks, recipient, f"New message: {payload.subject}", email_html, email_text)
    return {"ok": True, "message": "Message sent successfully."}
