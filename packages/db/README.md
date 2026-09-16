# @noadviceneeded/db

Drizzle ORM schema and migrations for Netlify Database (Neon Postgres in production, a local Postgres in development). `id uuid` primary keys, `created_at` / `updated_at` on every mutable table, money as `bigint` cents, units as `numeric`, soft delete only on `users`.

Tables: `users`, `brokerage_tokens`, `sessions`, `connections`, `accounts`, `positions`, `contribution_room`, `account_activities`, `order_batches`, `orders`.

## Provisioning

Nothing to provision by hand. Netlify creates the database on the first deploy that lists `@netlify/database` in `apps/web/package.json` and exposes it as `NETLIFY_DATABASE_URL` at runtime. Deploy previews get their own database branch. Locally, `pnpm dev` starts a Postgres through the Netlify Vite plugin and sets `NETLIFY_DB_URL`.

## Migrations

Generated from the schema into `apps/web/netlify/database/migrations`, the directory Netlify applies from:

```bash
pnpm db:generate
```

Commit the generated SQL and `meta/` folder together. Netlify's runner applies every `<number>_<slug>.sql` there, in order, before a deploy goes live. A failing migration blocks the deploy. Locally, apply pending migrations with `netlify database migrations apply`.

## Tests

`createTestDb()` from `@noadviceneeded/db/testing` boots an in-memory PGlite with every committed migration applied, so tests run against the real schema.
