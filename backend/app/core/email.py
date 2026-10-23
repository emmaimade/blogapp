import logging
import smtplib
from contextlib import contextmanager
from email.utils import formataddr
from typing import Iterator, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import BackgroundTasks
from app.core.config import settings

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 10


def send_smtp_email(to_email: str, subject: str, html_content: str, text_content: str):
    """
    Synchronous helper to connect to your configured SMTP provider
    and safely transmit the email payload.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    msg["To"] = to_email

    # Attach plain text first, HTML last — per MIME spec, clients render the
    # last part they can support, so HTML-capable clients prefer the HTML version.
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())
    except Exception:
        logger.exception("Failed to send email to %s (subject: %s)", to_email, subject)


def dispatch_email(background_tasks: BackgroundTasks, to_email: str, subject: str, html_content: str, text_content: str):
    """
    Offloads SMTP operations to FastAPI BackgroundTasks
    so your active API requests resolve instantly without lagging.
    """
    background_tasks.add_task(send_smtp_email, to_email, subject, html_content, text_content)

# ── Batches ──────────────────────────────────────────────────────────────────
# New-post emails go out many at a time from a cron job: one connection for
# the whole batch instead of one per message, and headers transactional mail
# doesn't need (List-Unsubscribe).

def build_message(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    from_name: Optional[str] = None,
    headers: Optional[dict[str, str]] = None,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name or settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL))
    msg["To"] = to_email
    for name, value in (headers or {}).items():
        msg[name] = value
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))
    return msg


@contextmanager
def smtp_connection() -> Iterator[smtplib.SMTP]:
    """An open, logged-in SMTP connection; connection errors propagate to the caller."""
    with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        yield server
