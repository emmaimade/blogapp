# Marketing images

Builds the images the marketing site (`frontend/site`) uses on the Features page and for link previews.

| Output (in `frontend/site/public`) | Made by |
|---|---|
| `images/multi-tenant-workspaces.webp`, `images/role-based-collaboration.webp` | `convert-illustrations.mjs`, from the originals in `source/` |
| `images/platform-admin.webp`, `images/publishing-control.webp` | `capture.mjs`: admin-studio screenshots in a browser frame |
| `og-image.png` (1200×630 link preview) | `capture.mjs`, from `templates/og.html` |

```bash
npm install
npx playwright install chromium
```

## Illustrations

```bash
npm run illustrations
```

## Screenshots and link preview

Screenshots are taken from a demo database filled with fictional data, never from real data. The real `backend/.env` points at Supabase, so every command below overrides `DATABASE_URL`. The seed script refuses to run against anything but SQLite.

Ports 8200 and 5190 keep the demo apart from the usual dev servers on 8000 and 5173 (and 8100, which another worktree uses).

```bash
# 1. Demo database (from backend/). Delete the file to start over.
DATABASE_URL=sqlite:///C:/tmp/inko-demo.db python scripts/seed_demo.py

# 2. Demo API (from backend/). SMTP_HOST=localhost keeps emails from leaving the machine.
DATABASE_URL=sqlite:///C:/tmp/inko-demo.db SMTP_HOST=localhost COOKIE_SECURE=false \
  CORS_ORIGINS=http://localhost:5190 python -m uvicorn app.main:app --port 8200

# 3. admin-studio against the demo API (from frontend/admin-studio/)
VITE_API_URL=http://localhost:8200 npx vite --port 5190 --strictPort

# 4. Capture (from here). `node capture.mjs studio` or `node capture.mjs og` runs one part.
npm run capture
```

Demo logins (password `DemoPass123!`): `morgan@example.com` (platform admin) and `lena@example.com` (owner of Lumen Studio, whose scheduled post is the editor shot).
