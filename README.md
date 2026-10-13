# Inko — Multi-Tenant Blogging Platform

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Inko is a hosted blogging platform. Anyone can sign up, create a workspace (a blog),
invite a team, and publish to their own subdomain (`{slug}.inko.blog`) or a custom
domain. This monorepo contains the API, the workspace studio, the public blog
renderer, and the marketing site.

## Live Deployments

- **Public Blog:** [https://blogapp-blog.vercel.app](https://blogapp-blog.vercel.app)
- **Admin Studio:** [https://blogapp-admin-studio-livid.vercel.app](https://blogapp-admin-studio-livid.vercel.app)
- **Marketing Site:** [https://blogapp-u6pi.vercel.app](https://blogapp-u6pi.vercel.app)
- **Backend API Docs:** [https://blogapp-eta-woad.vercel.app/docs](https://blogapp-eta-woad.vercel.app/docs)


## Project Architecture

```
blogapp/
├── backend/               # FastAPI REST API (Python 3.12, SQLModel, Alembic)
├── frontend/
│   ├── admin-studio/      # Workspace studio + platform superadmin (port 5173)
│   ├── blog/              # Public blog, one build serves every tenant (port 5174)
│   └── site/              # Marketing site: landing, pricing, signup (port 5175)
├── tools/
│   └── marketing-shots/   # Scripts that generate the site's screenshots and OG image
└── docs/                  # Architecture notes
```

How the pieces fit:

- **site** is the marketing front door: landing, features, pricing, contact and legal
  pages. Its signup and invitation links hand off to the studio, and emailed verification
  links land on its `/verify-email` page.
- **admin-studio** is where a workspace's members write posts, moderate comments,
  manage the team, change settings and billing. Platform superadmins get an extra area
  for every workspace, user, subscription, moderation report, support ticket and the
  platform audit log.
- **blog** works out which workspace it is serving from the hostname
  (`GET /blogs/resolve?host=...`), then renders that workspace's posts and branding.
- **backend** serves all three. Every workspace-scoped route lives under
  `/blogs/{blog_id}/...`.

## Quick Start

### Prerequisites

- **Python 3.12+** and [**uv**](https://docs.astral.sh/uv/getting-started/installation/)
- **Node.js 20+**
- **PostgreSQL** (tests use SQLite and need no database)
- A **Cloudinary** account (required: the API won't start without its credentials)

### 1. Backend

```bash
cd backend
cp .env.example .env     # then fill in DATABASE_URL, SECRET_KEY, CLOUDINARY_*
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

API at `http://localhost:8000`, docs at `http://localhost:8000/docs`.
See [backend/README.md](backend/README.md) for every environment variable.

### 2. Frontends

Each app is independent. Copy its `.env.example` to `.env`, then:

```bash
cd frontend/admin-studio   # or frontend/blog, frontend/site
npm install
npm run dev
```

| App | Port | README |
|-----|------|--------|
| admin-studio | 5173 | [frontend/admin-studio/README.md](frontend/admin-studio/README.md) |
| blog | 5174 | [frontend/blog/README.md](frontend/blog/README.md) |
| site | 5175 | [frontend/site/README.md](frontend/site/README.md) |

On `localhost` the blog has no hostname to resolve, so it serves the workspace whose
slug is in `VITE_BLOG_SLUG` (default `myblog`).

## Core Features

- **Workspaces**: self-serve signup with email verification (link or 6-digit code), guided onboarding, several workspaces per account
- **Teams**: owner / editor / author roles, email invitations, ownership transfer
- **Posts**: markdown editor, drafts, scheduled publishing, featured posts, image uploads, tags with usage counts
- **Comments**: threaded comments, flagging, workspace moderation with restore and per-blog bans
- **Settings**: general, about page (with live preview), footer, branding (logo/favicon), SEO and OG image, social links, contact page, Google Analytics
- **Billing**: Free / Pro / Team plans through Paystack, with trials, plan changes, a grace period and seat-limit pausing
- **Activity logs**: a per-workspace activity log, and a platform audit log with cursor paging, lookup and export
- **Platform admin**: workspaces, users, subscriptions, moderation queue, support tickets and platform settings
- **Notifications**: in-app notifications and transactional email
- **Security**: httpOnly cookie auth with refresh tokens, double-submit CSRF, login and content throttling, and a uniform error envelope with request IDs

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLModel, PostgreSQL, Alembic, APScheduler |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7 |
| Data fetching | TanStack Query, Axios |
| Forms | React Hook Form |
| Editor / rendering | EasyMDE (studio), React Markdown + remark-gfm + highlight.js |
| Services | Cloudinary (images), Paystack (billing), SMTP (email) |
| Hosting | Vercel (all four apps; Vercel Cron for scheduled jobs) |

## Database Migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "Describe the change"
uv run alembic upgrade head
uv run alembic downgrade -1
```

## Testing and Linting

```bash
cd backend && uv run pytest                 # SQLite, no external services
cd frontend/<app> && npm run lint && npm run build
```

## Troubleshooting

- **API won't start**: check `DATABASE_URL` and the three `CLOUDINARY_*` variables in `backend/.env`, then run `alembic upgrade head`.
- **CORS errors**: add the frontend's origin to `CORS_ORIGINS` in `backend/.env` (comma-separated). The default already covers ports 5173–5175 on `localhost` and `127.0.0.1`.
- **Blog shows "not found" locally**: set `VITE_BLOG_SLUG` in `frontend/blog/.env` to a slug that exists in your database.

## Contributing

1. Branch from `main`.
2. Keep backend tests green (`uv run pytest`) and frontends lint-clean (`npm run lint`).
3. Include a migration with any model change.
4. Open a PR against `main`.
