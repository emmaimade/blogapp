import logging
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.db import engine
from app.core.email import send_smtp_email
from app.core.email_templates import get_account_permanently_deleted_template, get_account_permanently_deleted_template_text
from app.models import User
from app.services.deletion import SOFT_DELETE_RETENTION_DAYS, deleted_prefix, purge_account, shared_owned_workspaces

logger = logging.getLogger("inko.tasks")


def purge_expired_soft_deleted_users() -> dict[str, int]:
    """
    Permanently erase accounts soft-deleted more than SOFT_DELETE_RETENTION_DAYS
    ago. Safe to run any number of times; returns what it did.

    Runs from the in-process scheduler and from the Vercel Cron endpoint
    (/internal/cron/purge-deleted-accounts). Each account is its own
    transaction, so one failure doesn't stop the rest.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=SOFT_DELETE_RETENTION_DAYS)
    summary = {"purged": 0, "skipped": 0, "failed": 0}

    with Session(engine) as session:
        expired = session.exec(
            select(User.id, User.email, User.first_name, User.last_name)
            .where(User.deleted_at != None)  # noqa: E711
            .where(User.deleted_at <= cutoff_date)
        ).all()

    if not expired:
        logger.info("[purge] No deleted accounts past the %s-day window.", SOFT_DELETE_RETENTION_DAYS)
        return summary

    for user_id, stored_email, first_name, last_name in expired:
        # Superadmin deletes renamed the address; mail the real one, not a
        # look-alike mailbox at the same domain.
        email = stored_email.removeprefix(deleted_prefix(user_id))
        full_name = " ".join(filter(None, [first_name, last_name])) or email

        with Session(engine) as session:
            try:
                # Deletes are refused for owners of shared workspaces, so this
                # only catches accounts deleted before that rule existed.
                shared = shared_owned_workspaces(session, user_id)
                if shared:
                    logger.warning(
                        "[purge] Skipped user %s: still owns shared workspace(s) %s.",
                        user_id,
                        [blog.id for blog in shared],
                    )
                    summary["skipped"] += 1
                    continue

                add_audit_log(
                    session,
                    action="system.user_purge",
                    resource_type="user",
                    resource_id=user_id,
                    details={"email": email, "retention_days": SOFT_DELETE_RETENTION_DAYS},
                )
                purge_account(session, user_id)
                session.commit()
            except Exception:
                session.rollback()
                logger.exception("[purge] Failed to purge user %s.", user_id)
                summary["failed"] += 1
                continue

        summary["purged"] += 1
        logger.info("[purge] Permanently deleted user %s.", user_id)

        try:
            send_smtp_email(
                email,
                "Your account has been permanently deleted",
                get_account_permanently_deleted_template(full_name),
                get_account_permanently_deleted_template_text(full_name),
            )
        except Exception:
            logger.exception("[purge] Couldn't send the deletion email for user %s.", user_id)

    logger.info("[purge] Done: %s", summary)
    return summary
