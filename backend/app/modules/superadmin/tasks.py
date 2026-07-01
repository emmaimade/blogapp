import logging
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.core.db import engine
from app.models import User

logger = logging.getLogger("inko.tasks")

def purge_expired_soft_deleted_users():
    """
    Background worker that runs automatically to permanently erase users 
    who have been soft-deleted for more than 30 days.
    """
    logger.info("⏰ Triggering scheduled background task: 30-Day Soft-Delete Purge...")
    
    # Target exactly 30 days ago
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
    
    with Session(engine) as session:
        # Query users who have passed their grace retention timeline
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
            try:
                # SQLModel cascade deletes dependencies based on relationship specifications
                session.delete(user)
                logger.info(f"💀 Permanently hard-deleted user ID: {user.id}")
            except Exception as e:
                logger.error(f"❌ Failed to hard-delete user ID {user.id}: {str(e)}")
                session.rollback()
                continue
                
        session.commit()
        logger.info("🏁 Background purge loop finalized successfully.")