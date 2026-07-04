import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import BackgroundTasks
from app.core.config import settings

def send_smtp_email(to_email: str, subject: str, html_content: str):
    """
    Synchronous helper to connect to your configured SMTP provider
    and safely transmit the email payload.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_content, "html"))

    try:
        # Assumes standard attributes are specified in your central app config/pydantic settings
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())
    except Exception as e:
        # Replace with your logging setup (e.g., logger.error) if preferred
        print(f"Failed to send email to {to_email}: {str(e)}")

def dispatch_email(background_tasks: BackgroundTasks, to_email: str, subject: str, html_content: str):
    """
    Offloads SMTP operations to FastAPI BackgroundTasks 
    so your active API requests resolve instantly without lagging.
    """
    background_tasks.add_task(send_smtp_email, to_email, subject, html_content)