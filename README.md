# No Advice Needed

An investing app for Canadians who already know what they want to own. Connect your brokerage accounts through SnapTrade, pick one all-in-one ETF, and buy or sell across every account with one click. The app decides which account comes first from an order you control, tracks contribution room for TFSA, RRSP, and FHSA accounts, and never moves cash: you deposit and withdraw at your brokerage.

Canada only for now. American users later.

Start with [docs/product.md](docs/product.md) for what the app does and why, [docs/architecture.md](docs/architecture.md) for how it is built, and [docs/decisions.md](docs/decisions.md) for the fixed decisions and open questions.

## Stack

- **Web:** React Router v7 (framework mode, SSR) on Netlify, Netlify DB (Neon Postgres), Tailwind CSS v4
- **Brokerage:** SnapTrade Personal OAuth. `read` scope at sign-in, `trade` scope on opt-in. Equity orders via check-then-place.
- **Engine:** pure TypeScript package shared by every surface, run server-side

## Repository layout

pnpm workspace.

| Path                 | Package                     | Purpose                                                                  |
| -------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `apps/web`           | `web`                       | React Router app: routes, loaders, actions, sync, order execution        |
| `packages/engine`    | `@noadviceneeded/engine`    | Pure TS: account types, orders, buy/sell plans, room. No I/O.            |
| `packages/db`        | `@noadviceneeded/db`        | Drizzle schema, client over `@netlify/database`, migrations, PGlite test |
| `packages/snaptrade` | `@noadviceneeded/snaptrade` | Typed client over SnapTrade Personal OAuth, including trading            |

## Getting started

Requires Node 22+ and pnpm 10 (`corepack enable` picks up the pinned version).

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The web app runs at <http://localhost:5173>. Routes: `/` (home and sign-in); `/app` (dashboard), `/app/invest`, `/app/withdraw`, `/app/accounts`, `/app/etf`, `/app/room`, `/app/orders`, all needing a session; `/auth/snaptrade/start` and `/auth/snaptrade/callback` (SnapTrade OAuth, sign-in and the trading consent step); `/auth/sign-out`; `/api/v1/health` (JSON).

`.env` needs four values before sign-in works (see `.env.example` for how to generate each): the SnapTrade OAuth client id and secret from the SnapTrade dashboard (Settings > OAuth App, with `http://localhost:5173/auth/snaptrade/callback` registered as a redirect URI), `SESSION_SECRET`, and `TOKEN_ENCRYPTION_KEY`. The same four go into Netlify's environment for deploys, plus the production callback URL registered at SnapTrade. Placing orders also needs SnapTrade to enable the partner-only `trade` scope for the app.

## Commands

```bash
pnpm typecheck        # every package, including react-router typegen
pnpm test             # vitest in engine, snaptrade, and web (web uses PGlite)
pnpm build            # production build into apps/web/build
pnpm lint             # eslint, whole repo
pnpm format           # prettier, whole repo
pnpm db:generate      # drizzle-kit migration from the schema
```

## Database

Netlify Database is provisioned on the first deploy and exposed as `NETLIFY_DATABASE_URL`; `pnpm dev` runs a local Postgres with `NETLIFY_DB_URL`. drizzle-kit writes migrations to `apps/web/netlify/database/migrations`, which Netlify applies on every deploy. See [packages/db/README.md](packages/db/README.md) for the local workflow.

## Deploying

The Netlify site's base directory is `apps/web`. Its `netlify.toml` runs `pnpm run build` there and publishes `build/client`; the server bundle becomes a Netlify serverless function through `@netlify/vite-plugin-react-router`. Netlify Database is provisioned on the first deploy, deploy previews get their own database branch, and migrations under `apps/web/netlify/database/migrations` are applied before each deploy goes live.
