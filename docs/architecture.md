# Architecture

## Shape

One React Router v7 app (framework mode, SSR) deployed as a Netlify serverless function, one Postgres (Netlify DB, Neon), three workspace packages. No separate API server; loaders and actions are the API. Everything runs on the Node target because SnapTrade OAuth libraries and Postgres drivers are Node-first.

```
apps/web            routes, loaders, actions, sync, execution
packages/engine     pure rules: classification, orders, plans, room
packages/db         Drizzle schema, Netlify DB client, PGlite for tests
packages/snaptrade  Personal OAuth + bearer client over the SnapTrade REST API
```

Dependency direction: `web -> db -> engine`, `web -> snaptrade`, `web -> engine`. The engine imports nothing.

## SnapTrade

Personal OAuth, verified against SnapTrade's discovery document: authorize at `dashboard.snaptrade.com/oauth/authorize`, token at `api.snaptrade.com/oauth/token/`, PKCE S256, confidential client with HTTP Basic. Access tokens last 10 hours; refresh tokens rotate on every use and are persisted before the new access token is used. Every API call is `Authorization: Bearer`; no `userId`, `userSecret`, `clientId`, or signature is ever sent.

Two consent moments. Sign-in requests `openid email read` and keys the user on the verified `id_token` `sub`. "Enable trading" repeats the authorize step with `openid email read trade`; SnapTrade skips the consent screen when an existing token already covers the scopes and returns to the same callback. `trade` is a partner-only scope that SnapTrade enables per registered app, re-checked on every trading request; a 403 on a `/trade` path surfaces as `TradingScopeMissing` and the UI offers the consent step.

Endpoints used, all bearer-authenticated:

| Purpose                 | Endpoint                                                     |
| ----------------------- | ------------------------------------------------------------ |
| Connections, accounts   | `GET /authorizations`, `GET /accounts`                       |
| Cash per currency       | `GET /accounts/{id}/balances`                                |
| Positions               | `GET /accounts/{id}/positions`                               |
| Symbol lookup           | `POST /accounts/{id}/symbols` `{ substring }`                |
| Quote (optional)        | `GET /accounts/{id}/quotes?symbols=<universal id>`           |
| Contributions           | `GET /accounts/{id}/activities?type=CONTRIBUTION,WITHDRAWAL` |
| Check an equity order   | `POST /trade/impact`                                         |
| Place the checked order | `POST /trade/{tradeId}` (the trade expires in 5 min)         |

SnapTrade data is daily-cached on most plans. The app reads at most once per 15 minutes per user (`SYNC_COOLDOWN_MS`), on page load, and clears the cooldown after placing orders so the next load re-reads.

## Sync

`syncUser` reads connections and accounts, then balances and positions for every open investment account, then contribution activities for registered accounts since the earliest room baseline. `applySnapTradeSnapshot` writes the read: identity columns and values are refreshed; the user's choices (`accountType`, `included`, `fractional`, both ranks) are set only on insert; positions are replaced per account when the read succeeded; connections SnapTrade stopped returning are marked `removed`. `assignMissingRanks` gives new accounts a place at the end of both orders without disturbing the user's ordering. All of this is tested against PGlite with the real migrations.

Cash is recorded in the target ETF's currency only (`accounts.cash_cents`). USD cash in an account is ignored for a CAD ETF.

## Planning

`packages/engine`:

- `planBuys(accounts, { priceCents })`: per included, tradable account, whole units from that account's own cash with a 1% buffer. Nothing is allocated across accounts because cash cannot move.
- `planSells(accounts, { amountCents, priceCents })`: walk the withdrawal order, sell `ceil(remaining / price)` whole units capped at what is held, until covered; report any shortfall.
- `remainingRoom(baseline, activities)`: baseline minus contributions dated after the baseline day.
- `suggestDeposit(accounts, roomByType)`: first included account in contribution order whose type has room; unlimited for non-registered; unknown room still suggests.

Price comes from, in order: a value the user typed, a brokerage quote (delayed, and disabled on some SnapTrade plans), the last price SnapTrade reported on a position of the ETF in any account. With no price, the Invest and Withdraw pages ask for one.

## Execution

`executeBatch` creates an `order_batches` row, then for each leg inserts an `orders` row and runs impact then place. Each step's result is written before the next call, so a crash mid-batch leaves an accurate record. A missing trade scope fails the remaining legs without calling SnapTrade. Legs run one at a time; one brokerage rejection does not stop the others. Orders are market, day, whole units, which every supported brokerage accepts.

## Data

`users` (target ETF lives here), `brokerage_tokens` (AES-256-GCM envelopes), `sessions`, `connections`, `accounts` (type, included, two ranks, cash), `positions`, `contribution_room` (baseline per type), `account_activities` (CONTRIBUTION and WITHDRAWAL), `order_batches`, `orders`. Money is `bigint` cents; units are `numeric(20,6)`.

## Security

Tokens at rest are AES-256-GCM envelopes keyed by `TOKEN_ENCRYPTION_KEY`; the version byte allows rotation. Session and OAuth-state cookies are signed with `SESSION_SECRET`, `httpOnly`, `SameSite=Lax`, `Secure` in production. OAuth starts on POST only. Every write checks the row belongs to the signed-in user via the `connections.user_id` join. The home page renders with no configuration so a bare deploy is never a 500.

## Local development

`pnpm dev` runs `react-router dev`; the Netlify Vite plugin starts a local Postgres and injects `NETLIFY_DB_URL`. Apply migrations locally with `netlify database migrations apply`. The four secrets in `.env.example` are needed for sign-in; the SnapTrade OAuth app must list `http://localhost:5173/auth/snaptrade/callback`.
