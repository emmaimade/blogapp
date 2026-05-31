# BlogApp Architecture Roadmap

This repo already has good foundations, but it mixes structural styles:

- `frontend/admin-studio` is mostly feature-oriented.
- `frontend/blog` is mostly page/component-oriented.
- `backend/app` is mostly layer-oriented.

That mix is normal in an evolving project, but it makes ownership fuzzy over time. The goal is not a big rewrite. The goal is to make each area easier to reason about by giving features clearer boundaries.

## Recommended target structure

### Admin frontend

Keep the current high-level layout and make feature ownership stricter.

```text
frontend/admin-studio/src/
  app/          # router, providers, bootstrap
  features/     # auth, posts, tags, comments, users, settings
  layouts/      # admin shell
  shared/       # generic ui, generic api client, reusable utilities
```

Rules:

- Feature-specific types, hooks, session logic, and API calls live inside the feature.
- `shared/` should only contain code that is genuinely cross-feature.
- Route files should compose features, not hold business logic.

### Public blog frontend

Move from broad buckets to route composition plus feature ownership.

```text
frontend/blog/src/
  app/          # providers, router, global app wiring
  features/     # posts, tags, search, settings, auth
  widgets/      # navbar, footer, newsletter, sidebar
  shared/       # generic utilities, shared api helpers, shared ui
  pages/        # thin route-level composition only
```

Rules:

- `App.tsx` should stay thin.
- SEO/theme/font bootstrapping should move into `app/` or a `settings` feature.
- `pages/` should orchestrate feature components instead of owning fetching and cross-cutting concerns.

### Backend

Move from technical layers to domain modules with thin routers.

```text
backend/app/
  core/         # config, db, auth/security
  modules/
    posts/
      router.py
      service.py
      repository.py
      models.py
      schemas.py
    tags/
    comments/
    users/
    settings/
  main.py
```

Rules:

- `router.py` handles HTTP concerns only.
- `service.py` handles business rules and workflows.
- `repository.py` handles query-heavy persistence operations when needed.
- Models and schemas should be grouped by domain, not stored in one large file.

## Incremental migration order

### Phase 1: Tighten admin boundaries

- Keep `app/router` and `app/providers` as the entry layer.
- Move auth token/session logic into `features/auth`.
- Move feature-specific types out of `shared/types`.
- Add feature-local API modules for auth, posts, tags, and users.

### Phase 2: Thin down public app bootstrap

- Move dynamic metadata/theme/font logic out of `frontend/blog/src/App.tsx`.
- Introduce `app/providers` and `app/router`.
- Convert route pages into composition shells around feature code.

### Phase 3: Modularize the backend

- Start with `posts`, because it currently mixes HTTP, media upload, ORM queries, and business rules.
- Split `models/models.py` into per-domain modules.
- Split `schemas/schemas.py` into per-domain modules.
- Move auth/config/db into a `core/` package.

## Practical standards to follow

- Prefer feature-first organization for product code.
- Keep entrypoints thin.
- Put cross-cutting infra in shared or core folders.
- Avoid dumping unrelated types into a single `index.ts` or `schemas.py`.
- Refactor by feature slice, not by massive repo-wide moves.

## Suggested next refactors

1. `frontend/blog/src/App.tsx` -> `app/router` + `app/providers`
2. `frontend/admin-studio/src/features/*` -> add feature-local API and type files consistently
3. Add per-module services where domain logic grows beyond the router
