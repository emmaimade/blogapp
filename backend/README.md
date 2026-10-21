# Backend API

FastAPI REST API for Inko. It serves the admin studio, the public blog and the
marketing site: auth, workspaces and members, posts, comments, settings, billing,
notifications, support, audit logs and platform administration.

**Live API**: [https://blogapp-eta-woad.vercel.app](https://blogapp-eta-woad.vercel.app) · [Docs](https://blogapp-eta-woad.vercel.app/docs) · [ReDoc](https://blogapp-eta-woad.vercel.app/redoc)

## Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL via SQLModel; Alembic for migrations
- **Auth**: JWT access and refresh tokens in httpOnly cookies, bcrypt, double-submit CSRF
- **Background jobs**: APScheduler in-process; Vercel Cron and an external pinger in production
- **Integrations**: Cloudinary (images), Paystack (billing), SMTP (email)
- **Python**: 3.12+, managed with [uv](https://docs.astral.sh/uv/)

## Quick Start

```bash
cd backend
cp .env.example .env        # fill in at least the "Required" variables below
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`, with docs at `/docs` and `/redoc`.

To make yourself a platform superadmin, sign up through the studio, then run:

```bash
uv run python scripts/create_admin.py you@example.com
```

## Environment Variables

Defined in [app/core/config.py](app/core/config.py); [.env.example](.env.example) lists them all.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image uploads. The app refuses to start without them |

### Auth and security

| Variable | Default | Description |
|----------|---------|-------------|
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access-token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh-token lifetime |
| `COOKIE_SECURE` | `true` | `Secure` flag on auth cookies (`localhost` works without changing it) |
| `TRUSTED_PROXY_HOPS` | `1` | Reverse proxies in front of the app, used to read the client IP from `X-Forwarded-For`. Use `0` when nothing proxies it |
| `CORS_ORIGINS` | prod + `localhost`/`127.0.0.1` on 5173–5175 and 8000 | Comma-separated allowed origins |

### Tenancy and limits

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_BLOG_BASE_DOMAIN` | `inko.blog` | Hosts ending in this resolve as `{slug}.{domain}`; any other host is looked up as a custom domain |
| `MAX_UPLOAD_SIZE_MB` | `5` | Upload size cap |
| `MAX_OWNED_WORKSPACES` | `10` | Workspaces one account may own (superadmins exempt) |
| `WORKSPACE_CREATIONS_PER_HOUR` | `5` | Workspace creation rate limit |

### Billing (Paystack)

Optional. Billing endpoints refuse to run until the secret key and plan codes are set.
Use `sk_test_` keys outside production.

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | — | API keys |
| `PAYSTACK_PLAN_{PRO,TEAM}_{MONTHLY,YEARLY}` | — | Plan codes (`PLN_...`) from the Paystack dashboard |
| `TRIAL_DAYS` | `14` | Trial length for new paid plans |
| `PAST_DUE_GRACE_DAYS` | `3` | How long a failed renewal keeps paid features |

### Email and URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS`, `SMTP_USER`, `SMTP_PASSWORD` | `localhost`, `25`, `true` | Outgoing mail |
| `EMAILS_FROM_EMAIL` (alias `EMAIL_FROM`), `EMAILS_FROM_NAME` | `no-reply@example.com`, `Inko` | Sender |
| `CONTACT_NOTIFICATION_EMAIL` | sender address | Recipient for the marketing site's contact form |
| `PUBLIC_SITE_URL` | `http://localhost:5175` | Marketing site, used in email links |
| `ADMIN_STUDIO_URL` | `http://localhost:5173` | Studio, used in email links |
| `PUBLIC_LOGO_URL` | Inko logo | Logo shown in emails |

### Jobs and observability

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_SECRET` | — | Bearer token Vercel Cron and the external pinger send to `/internal/cron/*`. Unset disables those endpoints (404) |
| `PURGE_ON_STARTUP` | `false` | Run the deleted-account purge in-process. Leave off when sharing a database |
| `LOG_LEVEL` | `INFO` | Log level |
| `SQL_ECHO` | `false` | Log every SQL statement (local debugging only) |

## Project Structure

```
backend/
├── app/
│   ├── main.py            # App, middleware stack, router registration
│   ├── core/              # Config, DB, security, errors, audit, plans, email, scheduler, middleware
│   ├── models/            # SQLModel tables (user, blog, post, comment, settings, audit, billing…)
│   ├── modules/           # One package per domain: router.py (+ service.py)
│   │   ├── auth/  blogs/  posts/  tags/  comments/  settings/  users/
│   │   ├── billing/  notifications/  support/  contact/
│   │   ├── superadmin/    # Platform-wide admin and audit log
│   │   └── cron/          # /internal/cron/* jobs for Vercel Cron
│   ├── schemas/           # Pydantic request/response models
│   └── services/          # Cross-cutting logic: auth tokens, throttling, account deletion
├── alembic/               # Migrations
├── scripts/               # One-off utilities (see below)
├── tests/                 # pytest suite
├── vercel.json            # Deployment + cron schedule
└── pyproject.toml
```

Requests pass through middleware in this order:
`CORS → RequestContext → AuditLog → RequirePasswordChange → CSRF → routes`.

## API Overview

The complete reference is at `/docs`. Most workspace-scoped routes are nested under
`/blogs/{blog_id}`.

| Area | Prefix | What it covers |
|------|--------|----------------|
| Auth | `/auth` | Login, refresh, logout, `me`, email verification (link and code), password reset/change, email change |
| Users | `/users` | Registration, own profile, own activity, account deletion |
| Workspaces | `/blogs` | Create, resolve by host/subdomain, onboarding steps, members, ownership transfer, dashboard, subscription |
| Invitations | `/blogs/{id}/invitations`, `/invitations/{token}` | Invite by email, accept (existing or new account) |
| Posts | `/blogs/{id}/posts` | CRUD, image upload, counts, scheduled, search, stats, by slug, related posts, flagging |
| Tags | `/blogs/{id}/tags` | CRUD, usage counts, popular tags |
| Comments | `/comments`, `/blogs/{id}/comments` | Post, edit, delete, flag; workspace moderation, restore and bans |
| Settings | `/blogs/{id}/settings` | General, about, footer, branding, social, SEO, contact, uploads, public bundle |
| Billing | `/blogs/{id}/billing`, `/billing/webhook` | Checkout, verify, plan change preview/apply/undo, cancel, Paystack webhook |
| Activity log | `/blogs/{id}/audit-logs` | Workspace activity with filters |
| Notifications | `/notifications` | List, unread count, mark read |
| Support | `/support` | User support tickets and replies |
| Contact | `/contact` | Marketing-site contact form |
| Superadmin | `/superadmin` | Stats, workspaces, users, subscriptions, moderation, support, platform settings, audit log (`/superadmin/audit-logs`) |
| Cron | `/internal/cron` | Publish scheduled posts, purge deleted accounts, trial notices (hidden from the schema) |

## Authentication

- `POST /auth/login` sets `access_token` and `refresh_token` as httpOnly cookies, plus a
  readable `csrf_token` cookie.
- Clients send credentials with every request (`withCredentials`) and echo the
  `csrf_token` cookie in an `X-CSRF-Token` header on unsafe methods.
- When the access token expires the client calls `POST /auth/refresh`. Refresh tokens
  are stored server-side, so logout and deletion can revoke them.
- Workspace roles are `owner`, `editor` and `author`. Platform superadmins are flagged
  with `is_super_admin`.
- Accounts given a temporary password are restricted to the password-change flow
  until they set a new one.

## Plans

Limits are defined in [app/core/plans.py](app/core/plans.py).

| | Free | Pro | Team |
|---|---|---|---|
| Members | 1 | 3 | 15 |
| Published posts | 30 | Unlimited | Unlimited |
| Scheduled posts, custom domain, remove branding | — | ✓ | ✓ |
| Activity log history | 7 days | 90 days | 365 days |

Members over a plan's seat limit are paused rather than removed.

## Background Jobs

- **In-process (APScheduler)**: publishes scheduled posts when they're due. Also purges
  soft-deleted accounts, but only if `PURGE_ON_STARTUP=true`. On Vercel this only runs
  while a function instance is warm, so production doesn't rely on it.
- **Vercel Cron** (see [vercel.json](vercel.json)): `purge-deleted-accounts` daily at 01:00 UTC
  and `trial-notices` daily at 08:00 UTC, both authenticated with `CRON_SECRET`.
- **External pinger** (e.g. [cron-job.org](https://cron-job.org)): calls
  `GET /internal/cron/publish-scheduled` every 1–5 minutes with the header
  `Authorization: Bearer <CRON_SECRET>`. Vercel Cron's Hobby plan only runs daily, too
  rarely for scheduled posts. Safe to run alongside the in-process scheduler: a post is
  only ever published once.

## Database Migrations

```bash
uv run alembic revision --autogenerate -m "Describe the change"
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic history
uv run alembic current
```

If `upgrade` reports multiple heads, create a merge revision
(`alembic merge -m "..." <rev1> <rev2>`).

## Error Handling

All errors return one envelope. Technical detail goes to the log, never the response.

```json
{
  "success": false,
  "message": "The post you're looking for could not be found.",
  "code": "POST_NOT_FOUND",
  "request_id": "3f9a1c74e8b24d5f9c0a1b2c3d4e5f60",
  "detail": "The post you're looking for could not be found."
}
```

Validation failures (422) add `errors`, keyed by field path:

```json
{
  "success": false,
  "message": "Please correct the highlighted fields.",
  "code": "VALIDATION_ERROR",
  "errors": { "title": "This field is required." }
}
```

`detail` mirrors `message` for backwards compatibility with existing clients that
read `err.response.data.detail`. New client code should branch on `code` — the
prose in `message` may be reworded at any time.

### Raising errors

Raise an `AppError` subclass. **Never raise `HTTPException`, and never put an
exception into a message** — the status and the public wording both come from the
error-code registry:

```python
from app.core.error_codes import ErrorCode
from app.core.exceptions import NotFoundError, ConflictError, ExternalServiceError

raise NotFoundError(ErrorCode.POST_NOT_FOUND)                 # 404, registry wording
raise ConflictError(ErrorCode.EMAIL_ALREADY_EXISTS)           # 409
raise NotFoundError(ErrorCode.POST_NOT_FOUND, "Custom copy.") # explicit override

# Technical context goes to log_message — it never reaches the client.
raise ExternalServiceError(
    ErrorCode.UPLOAD_FAILED,
    log_message=f"cloudinary rejected upload: {exc}",
)
```

Anything unexpected — a `TypeError`, an ORM failure, a bug — is caught centrally,
logged with a full traceback and the request context, and returned as a generic
`INTERNAL_ERROR` with the `request_id` the user can quote.

### Adding a new error

Add an `ErrorCode` member and its `ErrorSpec` in `app/core/error_codes.py`. That is
the whole change: status code, public message, and OpenAPI documentation follow.

| File | Role |
|------|------|
| `app/core/error_codes.py` | Taxonomy: code → HTTP status + public message |
| `app/core/exceptions.py` | `AppError` and its category subclasses |
| `app/core/error_handlers.py` | Handlers; the only place a body is built |
| `app/core/request_context.py` | `X-Request-ID` correlation, unhandled-error catch |
| `app/core/logging_config.py` | Log format, request-ID stamping |
| `app/schemas/errors.py` | OpenAPI models for the envelope |

`X-Request-ID` is returned on every response and accepted on requests, so a
frontend trace can be matched to the backend log line that recorded the failure.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed_demo.py` | Fills a throwaway **SQLite** database with fictional workspaces, used for marketing screenshots. Refuses to run against anything else. See [tools/marketing-shots](../tools/marketing-shots/README.md) |
| `scripts/migrate_to_multitenant.py` | One-time migration from the old single-tenant schema. Back up first |
| `scripts/create_admin.py <email>` | Makes an existing account a platform superadmin. Uses `DATABASE_URL` from `.env` |

## Testing

```bash
uv run pytest
uv run pytest tests/test_billing.py -q   # one file
```

Tests run against a throwaway SQLite file (`tests/conftest.py` pins `DATABASE_URL`
before the app is imported) and never open SMTP connections, so no live database
or credentials are needed.

The suite has one file per area: auth and refresh, CSRF, login and content
throttling, workspaces and onboarding, invitations and membership, plan limits and
billing, posts and publishing, tags, comments and moderation, settings and uploads,
notifications, account deletion, superadmin and audit logs, and the error contract
(`test_error_handling.py` includes a scanner that asserts no response leaks
tracebacks, SQL, file paths or driver names).

## Deployment

The API deploys to Vercel as a Python function ([vercel.json](vercel.json)). For any
production environment:

1. Set a strong `SECRET_KEY` and a `CRON_SECRET`.
2. Point `DATABASE_URL` at PostgreSQL and run `alembic upgrade head`.
3. Set `CORS_ORIGINS`, `PUBLIC_SITE_URL` and `ADMIN_STUDIO_URL` to the deployed frontends.
4. Configure SMTP and, if billing is on, the Paystack keys and plan codes. Point the
   Paystack webhook at `/billing/webhook`.

## Common Issues

- **App exits on startup**: a required variable is missing, usually `CLOUDINARY_*`.
- **CORS errors**: add the origin to `CORS_ORIGINS`.
- **403 on POST/PUT/DELETE from a client**: the `X-CSRF-Token` header is missing or doesn't match the `csrf_token` cookie.
- **Multiple Alembic heads**: see [Database Migrations](#database-migrations).
- **Emails not arriving locally**: with `SMTP_HOST=localhost` and no mail server, sends fail and are logged, but the request still succeeds. Use a dev SMTP catcher such as Mailpit.
