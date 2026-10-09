from fastapi import Query
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.schemas.datetime_mixin import UTCDatetimeMixin

class AuditLogRead(UTCDatetimeMixin, BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    actor_email: Optional[str] = None
    actor: Optional[str] = None
    # The actor's display name, when they still have an account.
    actor_name: Optional[str] = None
    action: str
    # From app.core.audit_catalog; filled on the superadmin log.
    label: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    resource_type: str
    target_type: Optional[str] = None
    resource_id: Optional[int] = None
    blog_id: Optional[int] = None
    blog_name: Optional[str] = None
    resource_label: Optional[str] = None
    details: Optional[dict] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MyAuditLogRead(UTCDatetimeMixin, BaseModel):
    """
    Response shape for GET /users/me/audit-logs — a user's own security
    trail. Deliberately doesn't carry a raw ip_address: showing a bare IP
    to the account owner themselves is low-value ("was this me?" is hard
    to answer from a number), so it's resolved into `device` (from the
    stored user agent) and `location` (best-effort IP geolocation; None
    for unresolvable/private IPs or if the lookup fails) instead.
    """
    id: int
    action: str
    resource_type: str
    description: Optional[str] = None
    details: Optional[dict] = None
    device: Optional[str] = None
    location: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogQueryParams(BaseModel):
    skip: int = Query(default=0, ge=0, description="Pagination skip offset")
    limit: int = Query(default=50, ge=1, le=200, description="Max entries to return")
    action: Optional[str] = Query(default=None, description="Filter by action name")
    resource_type: Optional[str] = Query(default=None, description="Filter by resource type")
    actor_user_id: Optional[int] = Query(default=None, description="Filter by actor user ID")
    search: Optional[str] = Query(
        default=None,
        description="Free-text search across actor email, action name, and event details. "
        "Applied server-side before pagination so result counts and page totals stay consistent.",
    )
    since: Optional[datetime] = Query(default=None, description="Only entries at or after this time")
    until: Optional[datetime] = Query(default=None, description="Only entries before this time")


class AuditLogActor(BaseModel):
    user_id: int
    email: Optional[str] = None
    name: Optional[str] = None


class AuditLogFilters(BaseModel):
    """
    What the workspace activity log can be filtered by: everyone who appears
    in the visible history, and how far back that history goes on the
    workspace's plan (None when there's no limit, e.g. for a superadmin).
    """
    history_days: Optional[int] = None
    actors: list[AuditLogActor]


class SuperadminAuditLogQueryParams(BaseModel):
    skip: int = Query(default=0, ge=0)
    limit: int = Query(default=50, ge=1, le=200)
    blog_id: Optional[int] = Query(default=None, description="Only this workspace")
    actor_user_id: Optional[int] = Query(default=None, description="Only this actor; also includes their sign-ins")
    action: Optional[str] = Query(default=None, description="Exact action name")
    category: Optional[str] = Query(default=None, description="A category from app.core.audit_catalog")
    severity: Optional[str] = Query(default=None, description="critical, warning or info")
    search: Optional[str] = Query(default=None, description="Actor email, action, IP address and event details")
    since: Optional[datetime] = Query(default=None, description="Only entries at or after this time")
    until: Optional[datetime] = Query(default=None, description="Only entries before this time")
    include_logins: bool = Query(default=False, description="Include user.login rows, which are hidden by default")


class AuditLogSummary(BaseModel):
    """Counts for the whole filtered set, ignoring the severity filter."""
    total: int
    by_severity: dict[str, int]


class AuditLogLookupWorkspace(BaseModel):
    id: int
    name: str
    slug: str


class AuditLogLookupUser(BaseModel):
    id: int
    name: Optional[str] = None
    email: str


class AuditLogLookup(BaseModel):
    workspaces: list[AuditLogLookupWorkspace]
    users: list[AuditLogLookupUser]
