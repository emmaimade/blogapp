# Public Blog

**Live:** [https://blogapp-blog.vercel.app](https://blogapp-blog.vercel.app)

The reader-facing blog for every Inko workspace. A single build serves all tenants: on
load it reads the hostname, asks the API which workspace owns it, and renders that
workspace's posts, branding and pages.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 (+ typography) · React Router 7 ·
TanStack Query · Axios · React Hook Form · React Markdown (remark-gfm, remark-breaks,
rehype-highlight) · react-hot-toast · Lucide icons

## Quick Start

```bash
cd frontend/blog
cp .env.example .env     # set VITE_BLOG_SLUG to a workspace that exists locally
npm install
npm run dev              # http://localhost:5174
```

| Script | Does |
|--------|------|
| `npm run dev` | Dev server on port 5174 |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend URL. Used for tenant resolution, and for all calls in dev. Production API calls go through `/api` |
| `VITE_BLOG_SLUG` | `myblog` | **Dev only.** On `localhost` there's no hostname to resolve, so the blog serves `{VITE_BLOG_SLUG}.inko.blog` |
| `VITE_ADMIN_STUDIO_URL` | `http://localhost:5173` | The only origin allowed to send About-page preview drafts |
| `VITE_MARKETING_SITE_URL` | — | Target of the "Powered by Inko" footer link. No link when unset |

## How Tenancy Works

[src/contexts/TenantContext.tsx](src/contexts/TenantContext.tsx) calls
`GET /blogs/resolve?host=<hostname>` before anything else renders.

- `slug.inko.blog` resolves by subdomain. Any other host is looked up as a workspace's
  custom domain.
- The resolved blog ID is cached in `localStorage` (`public_blog_id`), and the site
  settings cache is primed with the tenant's branding, so the navbar and footer never
  flash default branding.
- Every later request is scoped to `/blogs/{blog_id}/...`.

## Routes

| Path | Page |
|------|------|
| `/` | Home: featured and recent posts |
| `/blog` | All posts, paginated, filterable by tag |
| `/post/:slug` | Post with table of contents, share buttons, related posts and comments |
| `/search` | Search results |
| `/about`, `/contact` | Pages configured in the studio's settings |
| `/auth` | Reader sign-in / sign-up (needed to comment) |
| `/tag/:tag` | Redirects to the filtered `/blog` view |

## Project Structure

```
src/
├── App.tsx                 # Routes, Google Analytics loader
├── api/                    # Axios client (blogApi), CSRF, error helpers
├── contexts/               # TenantContext, AuthContext
├── pages/                  # One file per route
├── components/             # Navbar, Footer, PostCard/PostList, Comments, QuickSearch, Pagination, skeletons
│   └── post/               # ArticleHeader, ArticleBody, TableOfContents, ShareButtons, RelatedPosts
├── hooks/                  # useSiteSettings, usePagedPosts, usePageMeta, useSidebarData, useTheme, useAboutPreviewDraft…
├── utils/                  # SEO head tags, dates, images, favicon, social links
└── types/
```

## Notable Behaviour

- **Branding and SEO** come from the workspace's settings. `usePageMeta` and
  `utils/seo.ts` set the page title, meta description, link-preview image and favicon
  for each page.
- **Google Analytics 4** loads only when the workspace has set a Measurement ID in its
  SEO settings.
- **About-page preview**: the studio opens `/about` and sends draft content with
  `postMessage`. `useAboutPreviewDraft` accepts it only from `VITE_ADMIN_STUDIO_URL`,
  and only from the window that opened the page.
- **Dark mode** follows the system setting, with a manual toggle.

## Deployment

Deployed on Vercel. [vercel.json](vercel.json) rewrites `/api/*` to the backend, which
keeps auth cookies first-party, and sends everything else to `index.html`. Each
workspace's subdomain or custom domain must point at this deployment.

## Troubleshooting

- **Not-found screen on every page locally**: `VITE_BLOG_SLUG` doesn't match any workspace slug in your database.
- **API calls fail in dev**: check that `VITE_API_URL` points at the running backend and
  that `http://localhost:5174` is in the backend's `CORS_ORIGINS`.
- **Studio's About preview stays empty**: `VITE_ADMIN_STUDIO_URL` must exactly match the studio's origin.
