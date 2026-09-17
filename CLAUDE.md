# No Advice Needed — working notes for Claude

Read `docs/product.md` (what and why), `docs/architecture.md` (how), and `docs/decisions.md` (fixed decisions, open questions) before changing behaviour.

## Fixed decisions (see docs/decisions.md)

- SnapTrade **Personal OAuth only**. Never the Commercial model, never per-user `userSecret`, never consumer-key signing. `read` scope at sign-in; `trade` scope via incremental consent from the app banner.
- Equity orders go through `POST /trade/impact` then `POST /trade/{tradeId}`: market, day, whole units. Never `/trade/place` (force) and never notional orders.
- One pure TS engine (`packages/engine`) computes every plan and room figure. Routes only render engine output. Money is integer cents CAD; units are whole shares in plans.
- The pitch is two guidelines: registered accounts first, one all-in-one ETF. Copy leads with those and with "easy", never with the user already knowing what they want (D-013).
- Orders are user-initiated and confirmed per batch on the Invest or Withdraw page. No automation, no scheduling, no "recommended" fund. Copy avoids "recommend", "should", "best"; the app "suggests" the next deposit account from the user's own order.
- Cash never moves between accounts. The app buys with what is in each account and sells into each account; deposits and withdrawals happen at the brokerage.
- Canada only. Account types: `fhsa`, `tfsa`, `rrsp`, `non_registered`, `resp`, `other`. Room is tracked for the first three from a user-entered baseline minus synced contributions.

## Conventions

- pnpm monorepo: `apps/web`, `packages/{engine,db,snaptrade}`. Run everything from the repo root.
- Drizzle schema in `packages/db/src/schema`; `pnpm db:generate --name <slug>` writes to `apps/web/netlify/database/migrations`, which Netlify applies on deploy. Commit the SQL and `meta/` together. Never hand-edit a migration.
- Server-only modules end in `.server.ts`. Routes live in `apps/web/app/routes` and are registered in `app/routes.ts`. Types come from `./+types/<route>` after `react-router typegen` (part of `pnpm typecheck`).
- Tests: `vitest`. Engine and SnapTrade tests are pure; web tests run against PGlite with the real migrations (`@noadviceneeded/db/testing`). Add a test for every engine rule.
- Sync never overwrites the user's choices on an account (`accountType`, `included`, ranks). New accounts get appended to both orders.
- One dark theme, "Acid Ledger": colour, type and radius tokens in `apps/web/app/app.css`, shared primitives in `app/components/ui.tsx`, the account-type colour ramp in `app/lib/tiers.ts`. Build screens from those tokens and primitives, never raw hexes; lead with one big figure per screen, mono uppercase labels, and as little prose as the screen can carry. Lime means buy or focus, pink means sell.
- Format with `pnpm format`, lint with `pnpm lint`, and keep `pnpm typecheck` and `pnpm test` green before committing.
