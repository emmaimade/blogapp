"""
Every audit action the app logs, with a human label, a category and a
severity. Superadmin filters by category/severity run against these lists,
and tests/test_superadmin_audit_log.py fails if code logs an action that
isn't listed here — so a new action can't quietly land as "info".

Severity is about how much a platform admin should care when reviewing:
  critical — access or data loss across accounts: deleting users or
             workspaces, forcing passwords, changing platform settings
  warning  — security-relevant or worth a second look: password changes,
             access changes, removals, failed payments, flags
  info     — ordinary product use
"""

from dataclasses import dataclass
from typing import Literal

Severity = Literal["info", "warning", "critical"]
Category = Literal["auth", "users", "workspaces", "team", "content", "moderation", "settings", "billing", "support", "other"]

CATEGORIES: tuple[Category, ...] = (
    "auth", "users", "workspaces", "team", "content", "moderation", "settings", "billing", "support", "other",
)
SEVERITIES: tuple[Severity, ...] = ("critical", "warning", "info")

LOGIN_ACTION = "user.login"


@dataclass(frozen=True)
class ActionInfo:
    label: str
    category: Category
    severity: Severity


ACTIONS: dict[str, ActionInfo] = {
    # ── Sign-in and credentials ──────────────────────────────────────────
    "user.login": ActionInfo("Signed in", "auth", "info"),
    "user.email_verified": ActionInfo("Verified email", "auth", "info"),
    "user.verification_email_requested": ActionInfo("Requested a verification email", "auth", "info"),
    "user.forgot_password_requested": ActionInfo("Requested a password reset", "auth", "info"),
    "user.password_reset_completed": ActionInfo("Reset password", "auth", "warning"),
    "user.change_password": ActionInfo("Changed password", "auth", "warning"),
    "blog_owner.trigger_reset_email": ActionInfo("Sent a member a password reset", "auth", "warning"),
    "superadmin.trigger_reset_email": ActionInfo("Superadmin sent a password reset", "auth", "warning"),
    "superadmin.force_temporary_password": ActionInfo("Superadmin forced a temporary password", "auth", "critical"),
    # ── Accounts ─────────────────────────────────────────────────────────
    "user.register": ActionInfo("Signed up", "users", "info"),
    "user.register_via_invite": ActionInfo("Signed up from an invite", "users", "info"),
    "user.update_profile": ActionInfo("Updated profile", "users", "info"),
    "user.delete_account": ActionInfo("Deleted own account", "users", "critical"),
    "superadmin.user_status_update": ActionInfo("Superadmin changed a user's status", "users", "critical"),
    "superadmin.user_delete": ActionInfo("Superadmin deleted a user", "users", "critical"),
    # ── Workspaces ───────────────────────────────────────────────────────
    "blog.create": ActionInfo("Created a workspace", "workspaces", "info"),
    "blog.update": ActionInfo("Updated workspace details", "workspaces", "info"),
    "superadmin.blog_status_update": ActionInfo("Superadmin changed a workspace's status", "workspaces", "critical"),
    "superadmin.blog_delete": ActionInfo("Superadmin deleted a workspace", "workspaces", "critical"),
    # ── Workspace team ───────────────────────────────────────────────────
    "blog.member_add": ActionInfo("Added a member", "team", "info"),
    "blog.member_remove": ActionInfo("Removed a member", "team", "warning"),
    "blog.member_permissions_update": ActionInfo("Changed a member's role", "team", "warning"),
    "blog.member_leave": ActionInfo("Left a workspace", "team", "info"),
    "blog.ownership_transfer": ActionInfo("Transferred workspace ownership", "team", "warning"),
    # ── Content ──────────────────────────────────────────────────────────
    "post.draft": ActionInfo("Saved a draft", "content", "info"),
    "post.scheduled": ActionInfo("Scheduled a post", "content", "info"),
    "post.published": ActionInfo("Published a post", "content", "info"),
    "post.updated": ActionInfo("Updated a post", "content", "info"),
    "post.deleted": ActionInfo("Deleted a post", "content", "warning"),
    "post.welcome_created": ActionInfo("Created the welcome post", "content", "info"),
    "tag.create": ActionInfo("Created a tag", "content", "info"),
    "tag.update": ActionInfo("Updated a tag", "content", "info"),
    "tag.delete": ActionInfo("Deleted a tag", "content", "info"),
    "comment.create": ActionInfo("Commented", "content", "info"),
    "comment.update": ActionInfo("Edited a comment", "content", "info"),
    "comment.delete": ActionInfo("Deleted a comment", "content", "info"),
    # ── Moderation ───────────────────────────────────────────────────────
    "comment.moderator_delete": ActionInfo("Moderator removed a comment", "moderation", "warning"),
    "moderation.flag_post": ActionInfo("Flagged a post", "moderation", "warning"),
    "moderation.flag_comment": ActionInfo("Flagged a comment", "moderation", "warning"),
    "moderation.approve": ActionInfo("Approved flagged content", "moderation", "info"),
    "moderation.reject": ActionInfo("Dismissed a flag", "moderation", "info"),
    "moderation.remove": ActionInfo("Removed flagged content", "moderation", "warning"),
    # ── Settings ─────────────────────────────────────────────────────────
    "settings.updated": ActionInfo("Updated workspace settings", "settings", "info"),
    "branding.updated": ActionInfo("Updated branding", "settings", "info"),
    "superadmin.platform_settings_update": ActionInfo("Superadmin changed platform settings", "settings", "critical"),
    "superadmin.audit_log_export": ActionInfo("Superadmin exported the audit log", "settings", "warning"),
    # ── Billing ──────────────────────────────────────────────────────────
    "billing.checkout_started": ActionInfo("Started checkout", "billing", "info"),
    "billing.card_added": ActionInfo("Added a card", "billing", "info"),
    "billing.subscription_created": ActionInfo("Subscribed", "billing", "info"),
    "billing.subscription_renewed": ActionInfo("Subscription renewed", "billing", "info"),
    "billing.payment_succeeded": ActionInfo("Payment succeeded", "billing", "info"),
    "billing.payment_failed": ActionInfo("Payment failed", "billing", "warning"),
    "billing.plan_changed": ActionInfo("Changed plan", "billing", "info"),
    "billing.plan_change_undone": ActionInfo("Undid a plan change", "billing", "info"),
    "billing.subscription_canceled": ActionInfo("Canceled subscription", "billing", "warning"),
    "billing.trial_ended": ActionInfo("Trial ended", "billing", "info"),
    "billing.trial_extended": ActionInfo("Superadmin extended a trial", "billing", "warning"),
    "billing.plan_granted": ActionInfo("Superadmin granted a plan", "billing", "warning"),
    # ── Support ──────────────────────────────────────────────────────────
    "support.ticket_created": ActionInfo("Opened a support ticket", "support", "info"),
    "support.message_sent": ActionInfo("Replied to a support ticket", "support", "info"),
    "support.status_updated": ActionInfo("Changed a ticket's status", "support", "info"),
}


def action_info(action: str) -> ActionInfo:
    """Catalog entry, or a readable fallback for anything unlisted (old rows)."""
    known = ACTIONS.get(action)
    if known:
        return known
    words = action.replace(".", " ").replace("_", " ").strip()
    return ActionInfo(words[:1].upper() + words[1:], "other", "info")


def actions_in_category(category: str) -> list[str]:
    return [action for action, info in ACTIONS.items() if info.category == category]


def actions_with_severity(severity: str) -> list[str]:
    return [action for action, info in ACTIONS.items() if info.severity == severity]
