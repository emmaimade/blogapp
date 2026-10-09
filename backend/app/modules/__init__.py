from .auth.router import router as auth_router
from .comments.router import blog_router as blog_comments_router
from .comments.router import router as comments_router
from .contact.router import router as contact_router
from .posts.router import router as posts_router
from .settings.router import router as settings_router
from .tags.router import router as tags_router
from .users.router import router as users_router
from .blogs.router import router as blogs_router
from .blogs.invitations_router import router as blog_invitations_router
from .blogs.invitations_router import invitations_router
from .blogs.audit_router import router as audit_router
from .superadmin.router import router as superadmin_router
from .superadmin.audit_router import router as superadmin_audit_router
from .support.router import router as support_router
from .notifications.router import router as notifications_router
from .billing.router import router as billing_router

__all__ = [
    "auth_router",
    "posts_router",
    "tags_router",
    "users_router",
    "comments_router",
    "blog_comments_router",
    "contact_router",
    "settings_router",
    "blogs_router",
    "blog_invitations_router",
    "invitations_router",
    "audit_router",
    "superadmin_router",
    "superadmin_audit_router",
    "support_router",
    "notifications_router",
    "billing_router",
]