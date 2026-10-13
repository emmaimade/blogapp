"""
Platform audit log for superadmins: every workspace, with search, date
range, category/severity filters, counts and CSV export.

The list, the count, the summary and the export all build on
_audit_conditions(), so they can't disagree about what "these filters"
means.
"""

import csv
import io
import json
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import and_, func, or_
from sqlmodel import Session, select

from app.core.audit import add_audit_log
from app.core.audit_catalog import (
    ACTIONS,
    LOGIN_ACTION,
    action_info,
    actions_in_category,
    actions_with_severity,
)
from app.core.audit_describe import describe_audit_log
from app.core.datetimes import utc_now
from app.core.db import get_session
from app.core.permissions import require_super_admin
from app.core.security import get_current_user
from app.models import AuditLog, Blog, Post, SupportTicket, Tag, User
from app.schemas import (
    AuditLogLookup,
    AuditLogLookupUser,
    AuditLogLookupWorkspace,
    AuditLogRead,
    AuditLogSummary,
    SuperadminAuditLogQueryParams,
)

router = APIRouter(prefix="/superadmin/audit-logs", tags=["superadmin"])

EXPORT_LIMIT = 10_000
LOOKUP_LIMIT = 8

# Resource types whose id points at a User row (member-management actions
# record the target member's user id here, same as plain "user" actions).
_USER_RESOURCE_TYPES = {"user", "blog_member"}


def _audit_conditions(params: SuperadminAuditLogQueryParams, *, with_severity: bool = True) -> list:
    # The http.* rows AuditLogMiddleware writes for every mutating request
    # duplicate the semantic action already logged by the router.
    conditions = [~AuditLog.action.startswith("http.")]

    if params.blog_id is not None:
        conditions.append(AuditLog.blog_id == params.blog_id)
    if params.actor_user_id is not None:
        conditions.append(AuditLog.actor_user_id == params.actor_user_id)
    if params.action:
        conditions.append(AuditLog.action == params.action)
    if params.since:
        conditions.append(AuditLog.created_at >= params.since)
    if params.until:
        conditions.append(AuditLog.created_at < params.until)

    # Sign-ins are most of the volume and rarely what an investigation is
    # after. Looking at one person, or at sign-ins specifically, wants them.
    wants_logins = params.include_logins or params.actor_user_id is not None or params.action == LOGIN_ACTION
    if not wants_logins:
        conditions.append(AuditLog.action != LOGIN_ACTION)

    if params.category:
        if params.category == "other":
            conditions.append(AuditLog.action.not_in(list(ACTIONS)))
        else:
            conditions.append(AuditLog.action.in_(actions_in_category(params.category)))

    if with_severity and params.severity:
        matching = AuditLog.action.in_(actions_with_severity(params.severity))
        # Unlisted actions (old rows) count as info, as action_info() says.
        if params.severity == "info":
            matching = or_(matching, AuditLog.action.not_in(list(ACTIONS)))
        conditions.append(matching)

    if params.search:
        term = f"%{params.search.strip()}%"
        conditions.append(
            or_(
                AuditLog.actor_email.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.ip_address.ilike(term),
                AuditLog.details.ilike(term),
            )
        )

    return conditions


def _to_audit_log_read(
    log: AuditLog,
    blog_name: Optional[str] = None,
    resource_label: Optional[str] = None,
    actor_name: Optional[str] = None,
) -> AuditLogRead:
    try:
        details = json.loads(log.details) if log.details else {}
    except (TypeError, json.JSONDecodeError):
        details = {}

    info = action_info(log.action)
    return AuditLogRead(
        id=log.id,
        actor_user_id=log.actor_user_id,
        actor_email=log.actor_email,
        actor=log.actor_email,
        actor_name=actor_name,
        action=log.action,
        label=info.label,
        category=info.category,
        severity=info.severity,
        resource_type=log.resource_type,
        target_type=log.resource_type,
        resource_id=log.resource_id,
        blog_id=log.blog_id,
        blog_name=blog_name,
        resource_label=resource_label,
        details=details,
        description=describe_audit_log(log, details),
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
    )


def _to_audit_log_read_list(session: Session, logs: List[AuditLog]) -> List[AuditLogRead]:
    """
    Batch-resolves human-readable names for actors, workspaces and resources
    so superadmins don't have to cross-reference bare ids — one query per
    referenced table instead of a per-row join.
    """
    blog_ids = {log.blog_id for log in logs if log.blog_id is not None}
    blog_ids |= {log.resource_id for log in logs if log.resource_type == "blog" and log.resource_id is not None}
    blog_names: dict[int, str] = {}
    if blog_ids:
        rows = session.exec(select(Blog.id, Blog.name).where(Blog.id.in_(blog_ids))).all()
        blog_names = {bid: name for bid, name in rows}

    user_ids = {log.resource_id for log in logs if log.resource_type in _USER_RESOURCE_TYPES and log.resource_id is not None}
    user_ids |= {log.actor_user_id for log in logs if log.actor_user_id is not None}
    user_names: dict[int, str] = {}
    if user_ids:
        rows = session.exec(select(User.id, User.first_name, User.last_name).where(User.id.in_(user_ids))).all()
        user_names = {uid: f"{fn or ''} {ln or ''}".strip() for uid, fn, ln in rows}

    post_ids = {log.resource_id for log in logs if log.resource_type == "post" and log.resource_id is not None}
    post_titles: dict[int, str] = {}
    if post_ids:
        rows = session.exec(select(Post.id, Post.title).where(Post.id.in_(post_ids))).all()
        post_titles = {pid: title for pid, title in rows}

    tag_ids = {log.resource_id for log in logs if log.resource_type == "tag" and log.resource_id is not None}
    tag_names: dict[int, str] = {}
    if tag_ids:
        rows = session.exec(select(Tag.id, Tag.name).where(Tag.id.in_(tag_ids))).all()
        tag_names = {tid: name for tid, name in rows}

    ticket_ids = {log.resource_id for log in logs if log.resource_type == "support_ticket" and log.resource_id is not None}
    ticket_subjects: dict[int, str] = {}
    if ticket_ids:
        rows = session.exec(select(SupportTicket.id, SupportTicket.subject).where(SupportTicket.id.in_(ticket_ids))).all()
        ticket_subjects = {tid: subject for tid, subject in rows}

    def resource_label(log: AuditLog) -> Optional[str]:
        if log.resource_id is None:
            return None
        if log.resource_type in _USER_RESOURCE_TYPES:
            return user_names.get(log.resource_id) or None
        if log.resource_type == "blog":
            return blog_names.get(log.resource_id)
        if log.resource_type == "post":
            return post_titles.get(log.resource_id)
        if log.resource_type == "tag":
            return tag_names.get(log.resource_id)
        if log.resource_type == "support_ticket":
            return ticket_subjects.get(log.resource_id)
        return None

    return [
        _to_audit_log_read(
            log,
            blog_name=blog_names.get(log.blog_id) if log.blog_id is not None else None,
            resource_label=resource_label(log),
            actor_name=user_names.get(log.actor_user_id) or None if log.actor_user_id is not None else None,
        )
        for log in logs
    ]


@router.get("", response_model=List[AuditLogRead])
def get_audit_logs(
    response: Response,
    params: SuperadminAuditLogQueryParams = Depends(),
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """
    Platform audit log, newest first. X-Total-Count carries the filtered total.

    Paging is by cursor: `before_id` returns the entries just older than
    that one, `after_id` the ones just newer, and X-Has-Older / X-Has-Newer
    say whether there's more each way. Offsets shift as new entries land at
    the top while someone pages, repeating or skipping rows; a cursor
    doesn't. `at` jumps to a moment: the entries at or before it, from
    where the id cursors carry on. `skip` still works for callers that
    don't pass any of these.
    """
    if sum(value is not None for value in (params.before_id, params.after_id, params.at)) > 1:
        raise HTTPException(status_code=400, detail="Pass only one of before_id, after_id and at.")

    conditions = _audit_conditions(params)
    limit = params.limit
    cursor_id = params.before_id if params.before_id is not None else params.after_id
    # An unknown cursor (a shared link to entries since purged) reads as the first page.
    cursor = session.get(AuditLog, cursor_id) if cursor_id is not None else None

    if params.at is not None:
        logs = session.exec(
            select(AuditLog)
            .where(*conditions, AuditLog.created_at <= params.at)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit + 1)
        ).all()
        total = None
        has_older = len(logs) > limit
        has_newer = (
            session.exec(select(AuditLog.id).where(*conditions, AuditLog.created_at > params.at).limit(1)).first()
            is not None
        )
        logs = logs[:limit]
    elif cursor is None:
        # The total rides along on each row (a window count), saving a round
        # trip; only a page past the end needs the separate count.
        rows = session.exec(
            select(AuditLog, func.count().over().label("total"))
            .where(*conditions)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(params.skip)
            .limit(limit + 1)
        ).all()
        total = rows[0][1] if rows else None
        logs = [log for log, _ in rows]
        has_older, has_newer = len(logs) > limit, params.skip > 0
        logs = logs[:limit]
    elif params.before_id is not None:
        # (created_at, id) is the sort key, so ties on created_at fall back to id.
        older = or_(
            AuditLog.created_at < cursor.created_at,
            and_(AuditLog.created_at == cursor.created_at, AuditLog.id < cursor.id),
        )
        logs = session.exec(
            select(AuditLog)
            .where(*conditions, older)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit + 1)
        ).all()
        total = None
        has_older, has_newer = len(logs) > limit, True
        logs = logs[:limit]
    else:
        # Walk forward from the cursor, then flip back to newest first.
        newer = or_(
            AuditLog.created_at > cursor.created_at,
            and_(AuditLog.created_at == cursor.created_at, AuditLog.id > cursor.id),
        )
        logs = session.exec(
            select(AuditLog)
            .where(*conditions, newer)
            .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
            .limit(limit + 1)
        ).all()
        total = None
        has_older, has_newer = True, len(logs) > limit
        logs = list(reversed(logs[:limit]))

    if total is None:
        total = session.exec(select(func.count(AuditLog.id)).where(*conditions)).one()
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Has-Older"] = "true" if has_older else "false"
    response.headers["X-Has-Newer"] = "true" if has_newer else "false"

    return _to_audit_log_read_list(session, logs)


@router.get("/summary", response_model=AuditLogSummary)
def get_audit_log_summary(
    params: SuperadminAuditLogQueryParams = Depends(),
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """
    How many entries of each severity match the other filters — the
    severity filter itself is ignored, so every count stays visible as a
    way to switch to it.
    """
    rows = session.exec(
        select(AuditLog.action, func.count(AuditLog.id))
        .where(*_audit_conditions(params, with_severity=False))
        .group_by(AuditLog.action)
    ).all()

    by_severity = {"critical": 0, "warning": 0, "info": 0}
    for action, count in rows:
        by_severity[action_info(action).severity] += count
    return AuditLogSummary(total=sum(by_severity.values()), by_severity=by_severity)


@router.get("/lookup", response_model=AuditLogLookup)
def lookup_audit_log_subjects(
    q: Optional[str] = None,
    kind: Optional[Literal["workspace", "user"]] = None,
    user_id: Optional[int] = None,
    blog_id: Optional[int] = None,
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """
    Workspaces (by name or address) and users (by name or email) for the
    audit log's pickers. `user_id` / `blog_id` fetch one known record, to
    label a filter restored from the URL. `kind` limits a search to one
    of the two, since each picker only shows one.
    """
    workspaces: list[Blog] = []
    users: list[User] = []

    if blog_id is not None:
        blog = session.get(Blog, blog_id)
        workspaces = [blog] if blog else []
    if user_id is not None:
        user = session.get(User, user_id)
        users = [user] if user else []

    term = (q or "").strip()
    like = f"%{term}%"
    if term and kind != "user":
        workspaces = session.exec(
            select(Blog)
            .where(or_(Blog.name.ilike(like), Blog.slug.ilike(like), Blog.subdomain.ilike(like)))
            .order_by(Blog.name)
            .limit(LOOKUP_LIMIT)
        ).all()
    if term and kind != "workspace":
        full_name = func.coalesce(User.first_name, "") + " " + func.coalesce(User.last_name, "")
        users = session.exec(
            select(User)
            .where(or_(User.email.ilike(like), full_name.ilike(like)))
            .order_by(User.email)
            .limit(LOOKUP_LIMIT)
        ).all()

    return AuditLogLookup(
        workspaces=[AuditLogLookupWorkspace(id=b.id, name=b.name, slug=b.slug) for b in workspaces],
        users=[
            AuditLogLookupUser(
                id=u.id,
                name=" ".join(part for part in (u.first_name, u.last_name) if part) or None,
                email=u.email,
            )
            for u in users
        ],
    )


def _csv_safe(value: object) -> str:
    """Neutralise spreadsheet formulas in user-supplied text (CSV injection)."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/export")
def export_audit_logs(
    request: Request,
    params: SuperadminAuditLogQueryParams = Depends(),
    _: None = Depends(require_super_admin),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    The filtered log as CSV, newest first, capped at EXPORT_LIMIT rows.
    X-Export-Truncated says when the cap cut it short. The export itself
    is logged: who pulled the audit trail is part of the audit trail.
    """
    logs = session.exec(
        select(AuditLog)
        .where(*_audit_conditions(params))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(EXPORT_LIMIT + 1)
    ).all()
    truncated = len(logs) > EXPORT_LIMIT
    rows = _to_audit_log_read_list(session, logs[:EXPORT_LIMIT])

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "time_utc", "severity", "category", "action", "event", "description",
        "actor_email", "actor_name", "actor_user_id", "workspace", "workspace_id",
        "resource_type", "resource_id", "resource", "ip_address", "user_agent", "details",
    ])
    for row in rows:
        writer.writerow([_csv_safe(value) for value in (
            row.created_at.isoformat(), row.severity, row.category, row.action, row.label, row.description,
            row.actor_email, row.actor_name, row.actor_user_id, row.blog_name, row.blog_id,
            row.resource_type, row.resource_id, row.resource_label, row.ip_address, row.user_agent,
            json.dumps(row.details) if row.details else "",
        )])

    filters = {key: value for key, value in params.model_dump(mode="json", exclude={"skip", "limit"}).items() if value not in (None, False)}
    add_audit_log(
        session,
        action="superadmin.audit_log_export",
        resource_type="audit_log",
        actor=current_user,
        details={"filters": filters, "rows": len(rows), "truncated": truncated},
        request=request,
    )
    session.commit()

    filename = f"platform-audit-log-{utc_now().date().isoformat()}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Export-Truncated": "true" if truncated else "false",
        },
    )


@router.get("/{log_id:int}", response_model=AuditLogRead)
def get_audit_log(
    log_id: int,
    _: None = Depends(require_super_admin),
    session: Session = Depends(get_session),
):
    """One entry, for a shared link to it that's no longer on the first page."""
    log = session.get(AuditLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Audit log entry not found.")
    return _to_audit_log_read_list(session, [log])[0]
