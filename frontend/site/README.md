# Marketing Site

Inko's public marketing site: landing page, features, pricing, about, contact and
legal pages. It's the entry point that sends people to the studio to sign up.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 (+ typography) · React Router 7 · Axios ·
Lucide icons

## Quick Start

```bash
cd frontend/site
cp .env.example .env
npm install
npm run dev        # http://localhost:5175
```

| Script | Does |
|--------|------|
| `npm run dev` | Dev server on port 5175 |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend URL (contact form, email verification) |
| `VITE_ADMIN_STUDIO_URL` | `http://localhost:5173` | Studio origin that signup, login and invitation links go to |
| `VITE_SITE_URL` | — | This site's public URL, no trailing slash. Must be set **at build time** so the `og:image` and `og:url` tags in `index.html` are absolute |

## Routes

| Path | Page |
|------|------|
| `/` | Home |
| `/features`, `/pricing`, `/about`, `/contact` | Marketing pages |
| `/privacy`, `/terms`, `/acceptable-use` | Legal pages (content in `src/pages/legalDocuments.ts`) |
| `/signup` | Redirects to the studio's signup, or to `/join/:token` when there's an invite |
| `/verify-email` | Lands from the verification email, calls `/auth/verify-email`, and can resend |
| `/join/:token` | Hands an invitation off to the studio |

## Project Structure

```
src/
├── app/router/          # SiteRouter
├── pages/               # One file per route
└── shared/
    ├── config.ts        # API and studio URLs
    ├── plans.ts         # Pricing shown on /pricing
    ├── inko.tsx         # Brand mark
    ├── components/      # PageHero, PrimaryCta, FaqList, product mockups
    ├── hooks/           # usePageMeta
    └── layouts/         # PublicLayout, AuthLayout
public/                  # Favicons, logo, og-image.png, feature images
```

## Keeping Pricing in Sync

[src/shared/plans.ts](src/shared/plans.ts) duplicates plan data. When a plan changes,
update it together with the studio's `src/shared/lib/plans.ts`,
`backend/app/core/plans.py`, and the plan amounts in Paystack.

## Images

The feature screenshots and `public/og-image.png` are generated from a seeded demo
workspace. To regenerate them, see [tools/marketing-shots](../../tools/marketing-shots/README.md).

## Deployment

Deployed on Vercel as a static SPA ([vercel.json](vercel.json) sends every path to
`index.html`). Unlike the studio and blog, it calls the API directly at `VITE_API_URL`.
It doesn't use auth cookies, so it needs no `/api` proxy. Its origin must still be in the
backend's `CORS_ORIGINS`.
