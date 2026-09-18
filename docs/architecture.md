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

| Purpose               | Endpoint                                                     |
| --------------------- | ------------------------------------------------------------ |
| Connections, accounts | `GET /authorizations`, `GET /accounts`                       |
| Cash per currency     | `GET /accounts/{id}/balances`                                |
| Positions             | `GET /accounts/{id}/positions`                               |
| Symbol lookup         | `POST /accounts/{id}/symbols` `{ substring }`                |
| Quote (optional)      | `GET /accounts/{id}/quotes?symbols=<universal id>`           |
| Contributions         | `GET /accounts/{id}/activities?type=CONTRIBUTION,WITHDRAWAL` |
| Place an equity order | `POST /trade/place` (one call, `client_order_id` = order id) |

SnapTrade data is daily-cached on most plans. The app reads at most once per 15 minutes per user (`SYNC_COOLDOWN_MS`), on page load, and clears the cooldown after placing orders so the next load re-reads.

## Sync

`syncUser` reads connections and accounts, then balances and positions for every open investment account, then contribution activities for registered accounts since the earliest room baseline. `applySnapTradeSnapshot` writes the read: identity columns and values are refreshed; the user's choices (`accountType`, `included`, `fractional`, both ranks) are set only on insert, classified and ranked for the user's country; positions are replaced per account when the read succeeded; connections SnapTrade stopped returning are marked `removed`. `assignMissingRanks` gives new accounts a place at the end of both orders without disturbing the user's ordering. `setCountry` (`country.server.ts`) is the one deliberate exception: switching country re-types every account, resets both orders and clears the fund. All of this is tested against PGlite with the real migrations.

Cash is recorded in the target ETF's currency only (`accounts.cash_cents`). USD cash in an account is ignored for a CAD ETF and the reverse. Screens format the country's home currency (`HOME_CURRENCY`) as a bare "$" and prefix any other (`useMoney`).

## Planning

`packages/engine`:

- `planBuys(accounts, { priceCents })`: per included, tradable account, an order from that account's own cash: whole units with a 1% buffer, or, when the user ticked `fractional` for the account, all of the cash as a dollar amount (`notionalCents`, no buffer, no floor) with the units an estimate for display. Nothing is allocated across accounts because cash cannot move.
- `planSells(accounts, { amountCents, priceCents })`: walk the withdrawal order; a whole-unit account sells `ceil(remaining / price)` units capped at its whole units, a fractional account sells the remaining dollars capped at `sellableCents` (its whole position at the plan price); report any shortfall.
- `remainingRoom(baseline, activities)`: baseline minus contributions dated after the baseline day.
- `roomTypeFor(accountType)`: the limit an account draws on. Identity for TFSA, RRSP, FHSA and HSA; both IRA types map to `ira`; null for everything else.
- `suggestDeposit(accounts, roomByType)`: first included account in contribution order whose limit has room; unlimited for types with no limit; unknown room still suggests.

Price comes from, in order: a value the user typed, a brokerage quote (delayed, and disabled on some SnapTrade plans), the last price SnapTrade reported on a position of the ETF in any account. With no price, the Invest and Withdraw pages ask for one.

## Execution

The Invest and Withdraw actions first check `marketSession(country, now)` from the engine (the TSX or NYSE, 9:30 to 16:00 Eastern, holidays and NYSE early closes by rule) and refuse to place orders while the exchange is closed; the pages show the next opening bell instead of the button (D-017).

`executeBatch` creates an `order_batches` row, then for each leg inserts an `orders` row and places it with one `POST /trade/place` call (D-018), sending the row's id as `client_order_id` so a retried request cannot place the same order twice. The result is written to the row as soon as it returns, so a crash mid-batch leaves an accurate record. The rows are inserted in plan order, then every leg is placed concurrently: each is its own account, so one brokerage rejection (or a missing trade scope) is recorded on its row and the others finish on their own, and a batch across many accounts takes about as long as one leg rather than the sum, which is what tripped the request timeout on the first six-account batch. Orders are market, day: whole `units` (with `notional_value: null`), which every supported brokerage accepts, or `notional_value` in dollars (with `units: null`) for accounts the user marked fractional, which is how Wealthsimple fills fractions. For a dollar-sized order the `total_quantity` SnapTrade reports replaces the plan's estimate on the `orders` row. SnapTrade exposes no capability flag under Personal OAuth, so a dollar-amount order the brokerage will not fill is refused on that call and the refusal is recorded on the order.

## Data

`users` (country and target ETF live here), `brokerage_tokens` (AES-256-GCM envelopes), `sessions`, `connections`, `accounts` (type, included, fractional, two ranks, cash), `positions`, `contribution_room` (baseline per room type; `ira` covers both IRAs), `account_activities` (CONTRIBUTION and WITHDRAWAL), `order_batches`, `orders` (units, `notional_cents` when sized by dollar amount). Money is `bigint` cents; units are `numeric(20,6)`.

## Security

Tokens at rest are AES-256-GCM envelopes keyed by `TOKEN_ENCRYPTION_KEY`; the version byte allows rotation. Session and OAuth-state cookies are signed with `SESSION_SECRET`, `httpOnly`, `SameSite=Lax`, `Secure` in production. OAuth starts on POST only. Every write checks the row belongs to the signed-in user via the `connections.user_id` join. The home page renders with no configuration so a bare deploy is never a 500.

## Local development

`pnpm dev` runs `react-router dev`; the Netlify Vite plugin starts a local Postgres and injects `NETLIFY_DB_URL`. Apply migrations locally with `netlify database migrations apply`. The four secrets in `.env.example` are needed for sign-in; the SnapTrade OAuth app must list `http://localhost:5173/auth/snaptrade/callback`.
