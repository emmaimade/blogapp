import logging
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.core.db import engine
from app.core.email import send_smtp_email
from app.core.email_templates import get_account_permanently_deleted_template, get_account_permanently_deleted_template_text
from app.models import User

logger = logging.getLogger("inko.tasks")

def purge_expired_soft_deleted_users():
    """
    Background worker that runs automatically to permanently erase users 
    who have been soft-deleted for more than 30 days.
    """
    logger.info("⏰ Triggering scheduled background task: 30-Day Soft-Delete Purge...")
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
    
    with Session(engine) as session:
        statement = (
            select(User)
            .where(User.deleted_at != None)
            .where(User.deleted_at <= cutoff_date)
            .options(
                selectinload(User.blog_memberships),
                selectinload(User.owned_blogs)
            )
        )
        expired_users = session.exec(statement).all()
        
        if not expired_users:
            logger.info("✅ No expired user accounts found pending permanent deletion.")
            return

        logger.info(f"🗑️ Found {len(expired_users)} user account(s) ready for permanent deletion.")

        for user in expired_users:
            # Capture identity details BEFORE the delete — the row won't exist to read from afterward.
            user_email = user.email
            full_name = f"{user.first_name} {user.last_name}"

            try:
                session.delete(user)
                session.commit()
                logger.info(f"💀 Permanently hard-deleted user ID: {user.id}")
            except Exception as e:
                logger.error(f"❌ Failed to hard-delete user ID {user.id}: {str(e)}")
                session.rollback()
                continue

            try:
                email_html = get_account_permanently_deleted_template(full_name)
                email_text = get_account_permanently_deleted_template_text(full_name)
                send_smtp_email(user_email, "Your account has been permanently deleted", email_html, email_text)
            except Exception as e:
                logger.error(f"❌ Failed to send deletion confirmation email to {user_email}: {str(e)}")

        logger.info("🏁 Background purge loop finalized successfully.")