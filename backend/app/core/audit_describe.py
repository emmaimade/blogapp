"""
Human-readable sentences for audit log rows, shared by the workspace
activity log and the superadmin audit log so the two can't drift apart.

Settings-style diffs name the fields that changed rather than inlining the
values (which can be whole paragraphs); both logs show the per-field
before/after when an entry is opened.
"""

from datetime import datetime
from typing import Any

from app.core.audit_catalog import action_info
from app.models import AuditLog


ROLE_LABELS = {
    "owner": "Owner",
    "editor": "Editor",
    "author": "Author",
    "viewer": "Viewer",
}


def _role_label(role: Any) -> str:
    if isinstance(role, str):
        return ROLE_LABELS.get(role.lower(), role)
    return str(role) if role is not None else "unknown"


SETTINGS_LABELS = {
    "general": "general settings",
    "about": "the About page",
    "footer": "the footer",
    "seo": "SEO settings",
    "contact": "the contact page",
}


def _with_fields(base: str, changes: Any) -> str:
    """'Updated SEO settings: meta title, meta description'"""
    if not isinstance(changes, dict) or not changes:
        return base
    return f"{base}: {', '.join(field.replace('_', ' ') for field in changes)}"


def _format_datetime_label(value: Any) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
        return parsed.strftime("%b %d, %Y at %I:%M %p UTC")
    except (ValueError, TypeError):
        return None


def describe_audit_log(log: AuditLog, details: dict[str, Any]) -> str:
    """
    Generates active-voice, human-readable action descriptions, using the
    richer before/after shapes logged for the highest-value actions
    (member roles, settings, blog details, platform settings, profile
    updates, status toggles) where available, falling back to a plain
    action label otherwise.
    """
    action = log.action.lower()

    # Extract target email across common payload naming conventions
    target_email = (
        details.get("email")
        or details.get("member_email")
        or details.get("target_email")
        or details.get("user_email")
    )

    # Target label fallback: Use target email if present, else fallback to Resource ID
    if target_email:
        target_label = target_email
    elif log.resource_id:
        target_label = f"member #{log.resource_id}"
    else:
        target_label = "team member"

    # --- Team Member Actions ---
    if "member_permissions_update" in action or "member_role_update" in action or "member.updated" in action:
        role_change = details.get("changes", {}).get("role") if isinstance(details.get("changes"), dict) else None
        if role_change:
            return f"Changed {target_label}'s role from {_role_label(role_change.get('from'))} to {_role_label(role_change.get('to'))}"
        return f"Updated permissions for {target_label}"

    if "member_add" in action or "member.added" in action:
        role = details.get("role")
        return f"Added {target_label} to workspace" + (f" as {_role_label(role)}" if role else "")

    if "member_remove" in action or "member.removed" in action:
        role = details.get("role")
        return f"Removed {target_label} from workspace" + (f" ({_role_label(role)})" if role else "")

    # --- Post / Content Actions ---
    # Posts encode status in the action name itself (post.published, post.draft,
    # post.scheduled) rather than post.created, so these are handled by exact
    # action match rather than substring, ahead of the generic create/update checks.
    title = details.get("title")
    if action == "post.deleted" or "post_delete" in action:
        return f'Deleted post "{title}"' if title else "Deleted a post"
    if action == "post.updated" or "post_update" in action:
        return f'Updated post "{title}"' if title else "Updated a post"
    if action == "post.published":
        return f'Published post "{title}"' if title else "Published a post"
    if action == "post.scheduled":
        when = _format_datetime_label(details.get("published_at"))
        base = f'Scheduled post "{title}"' if title else "Scheduled a post"
        return f"{base} for {when}" if when else base
    if action == "post.draft":
        return f'Saved post "{title}" as a draft' if title else "Saved a post as a draft"
    if "post.created" in action or "post_create" in action:
        return f'Created post "{title}"' if title else "Created a new post"

    # --- Workspace & Settings Actions ---
    # These name the fields that changed rather than inlining the values —
    # settings values can be whole paragraphs (the About page), and the
    # activity log shows the before/after per field when an entry is opened.
    if "settings.updated" in action or "branding.updated" in action:
        label = "branding" if "branding" in action else SETTINGS_LABELS.get(details.get("key"), "workspace settings")
        return _with_fields(f"Updated {label}", details.get("changes"))

    if "blog.update" in action or "blog_update" in action:
        return _with_fields("Updated workspace details", details.get("changes"))

    if "update_profile" in action:
        return _with_fields("Updated profile", details.get("changes"))

    # --- Comment Actions ---
    # Comments use "post_title" rather than "title" so they don't get swept
    # into the post-specific branch above. Readers must register to comment
    # on the public blog, so most comment.create rows are ordinary readers,
    # not workspace team members — call that out when it's a team member,
    # since that's the more notable case in a workspace's own activity log.
    if log.resource_type == "comment":
        post_title = details.get("post_title")
        on_post = f' on "{post_title}"' if post_title else (f" on post #{details['post_id']}" if details.get("post_id") else "")

        if action in ("comment.create", "comment.created"):
            role = details.get("commenter_role")
            if role and role != "reader":
                return f"Commented{on_post} (as {_role_label(role)})"
            return f"A reader commented{on_post}"

        if action in ("comment.update", "comment.updated"):
            return f"Edited a comment{on_post}"

        if action in ("comment.delete", "comment.deleted", "comment.moderator_delete"):
            deleted_by = details.get("deleted_by")
            if action == "comment.moderator_delete" or deleted_by == "moderator":
                return f"Removed a comment{on_post} (moderator)"
            return f"Deleted a comment{on_post}"

    # --- Tag Actions ---
    if "tag.created" in action or "tag.create" in action:
        name = details.get("name")
        return f'Created tag "{name}"' if name else "Created a tag"

    if "tag.deleted" in action or "tag.delete" in action:
        name = details.get("name")
        return f'Deleted tag "{name}"' if name else "Deleted a tag"

    # --- Superadmin Actions ---
    # Older rows logged {"is_active": bool}; newer ones {"from", "to"}.
    if action in ("superadmin.blog_status_update", "superadmin.user_status_update"):
        active = details["to"] if "to" in details else details.get("is_active")
        if isinstance(active, bool):
            subject = "workspace" if "blog" in action else "user account"
            return f"{'Reactivated' if active else 'Deactivated'} a {subject}"

    if action == "superadmin.platform_settings_update":
        return _with_fields("Changed platform settings", details.get("changes"))

    # --- Named resources (support tickets, etc.) ---
    name = details.get("name") or details.get("title") or details.get("subject")
    if name:
        noun = log.resource_type.replace("_", " ")
        if action.endswith((".create", ".created")):
            return f'Created {noun} "{name}"'
        if action.endswith((".update", ".updated")):
            return f'Updated {noun} "{name}"'
        if action.endswith((".delete", ".deleted")):
            return f'Deleted {noun} "{name}"'

    # --- Everything else: the catalog's label, plus what changed ---
    label = action_info(log.action).label
    if "from" in details and "to" in details:
        return f"{label}: {details['from']} → {details['to']}"
    if details.get("changes"):
        return _with_fields(label, details["changes"])
    fields = details.get("fields")
    if fields:
        return f"{label}: {', '.join(str(field).replace('_', ' ') for field in fields)}"
    return label
