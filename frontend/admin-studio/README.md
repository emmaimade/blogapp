# Admin Studio

**Live:** [https://blogapp-admin-studio-livid.vercel.app](https://blogapp-admin-studio-livid.vercel.app)

The Inko studio, a React + TypeScript app with two areas:

- **Workspace studio** (`/admin/w/:workspaceSlug/...`): where a workspace's members
  write and publish, moderate comments, manage the team, and configure the blog and billing.
- **Platform admin** (`/admin/superadmin`, `/admin/blogs`, …): visible only to platform
  superadmins. Covers every workspace, user, subscription, moderation report and support
  ticket, plus the platform audit log.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · React Router 7 · TanStack Query ·
Axios · React Hook Form · EasyMDE (markdown editor) · React Markdown · react-day-picker ·
react-hot-toast · Lucide icons

## Quick Start

```bash
cd frontend/admin-studio
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

The backend must be running (see [backend/README.md](../../backend/README.md)).

| Script | Does |
|--------|------|
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend URL, **dev only**. Production builds always call `/api` (see Deployment) |
| `VITE_BLOG_URL` | `http://localhost:5174` | Public blog origin in dev, for "view post" links |
| `VITE_SITE_URL` | `http://localhost:5175` | Marketing site, linked from the login and auth pages |
| `VITE_PUBLIC_SITE_URL` | `:5174` in dev, otherwise own origin | Blog origin that the About-page live preview loads |

## Project Structure

```
src/
├── app/
│   ├── router/AppRouter.tsx   # Every route
│   └── providers/             # Query client, auth, active-workspace (BlogProvider)
├── features/                  # One folder per feature: pages/, components/, hooks/, lib/
│   ├── auth/                  # Login, signup, verify email, forgot/reset/forced password change
│   ├── onboarding/            # First-run setup for a new workspace
│   ├── workspaces/            # Create and switch workspaces
│   ├── dashboard/
│   ├── posts/                 # List, editor, view
│   ├── tags/  comments/  users/
│   ├── settings/              # General, about, footer, branding, SEO, social, contact
│   ├── billing/               # Plan, checkout, Paystack callback
│   ├── audit-log/             # Workspace activity log
│   ├── notifications/  search/  support/
│   └── superadmin/            # Platform admin pages and API
├── layouts/                   # AdminLayout (sidebar shell), AuthLayout
└── shared/
    ├── api/                   # Axios client, CSRF, auth calls, query client
    ├── lib/                   # API error mapping, plans, workspace paths, theme
    ├── components/  ui/       # Modal, unsaved-changes dialog, skeletons, Switch, PlanBadge…
    ├── hooks/  types/  utils/
```

A new feature goes in its own `features/<name>/` folder. Shared code goes in `shared/`
only once a second feature needs it.

## Routes

| Path | Page |
|------|------|
| `/admin/login`, `/signup`, `/admin/forgot-password`, `/admin/reset-password` | Auth |
| `/join/:token` | Accept a team invitation |
| `/admin/workspaces/new` | Create a workspace |
| `/admin/w/:slug/onboarding` | Workspace setup |
| `/admin/w/:slug/dashboard` | Dashboard |
| `/admin/w/:slug/posts`, `posts/new`, `posts/edit/:id`, `posts/view/:id` | Posts |
| `/admin/w/:slug/tags`, `comments`, `users`, `activity` | Tags, comment moderation, team, activity log |
| `/admin/w/:slug/settings/{general,about,footer,branding,seo,social,contact,billing}` | Settings and billing |
| `/admin/profile`, `/admin/search`, `/admin/support-tickets` | Account, search, own support tickets |
| `/admin/superadmin`, `/admin/analytics`, `/admin/blogs`, `/admin/platform-users`, `/admin/subscriptions`, `/admin/moderation`, `/admin/audit-log`, `/admin/platform-settings`, `/admin/support` | Platform admin |

## How It Talks to the API

- All requests go through the Axios instance in
  [src/shared/api/client.ts](src/shared/api/client.ts), with `withCredentials: true`.
  Auth lives in httpOnly cookies, and the app never sees a token.
- On `POST/PUT/PATCH/DELETE` the client copies the `csrf_token` cookie into an
  `X-CSRF-Token` header.
- On a 401 the client calls `/auth/refresh` once (requests share a single in-flight
  refresh) and retries. A failed refresh caused by a server error doesn't sign the
  user out.
- Errors use the backend's envelope. Branch on `code` rather than `message`; helpers
  are in [src/shared/lib/apiErrors.tsx](src/shared/lib/apiErrors.tsx).

## Deployment

Deployed on Vercel. [vercel.json](vercel.json) rewrites `/api/*` to the backend and
everything else to `index.html`. Because of the rewrite, the auth cookies are
first-party, and production builds call `/api` regardless of `VITE_API_URL`. To deploy
against a different backend, change the rewrite destination.

Set `VITE_SITE_URL` (and `VITE_PUBLIC_SITE_URL` if the blog lives on another origin)
at build time.

## Troubleshooting

- **Logged out on every reload in dev**: the backend's `CORS_ORIGINS` must include
  `http://localhost:5173`, and you must use the same host name (`localhost` or `127.0.0.1`)
  for the studio and the API.
- **403 "session could not be verified"**: the CSRF cookie is stale. Refresh the page, or
  clear the site's cookies.
- **Port 5173 in use**: `npm run dev -- --port 5180`, and add that origin to `CORS_ORIGINS`.
