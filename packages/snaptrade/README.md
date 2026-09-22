# @noadviceneeded/snaptrade

Typed client over SnapTrade **Personal OAuth**. Everything above this package (sync, planning, orders) depends on this client, never on the SnapTrade SDK. The SDK is not used: its auth modes are the signed-request ones, and an OAuth request is a plain `Authorization: Bearer` call.

- Personal OAuth only. The user owns the SnapTrade account and authorizes this app, which receives scoped bearer tokens. Never the Commercial model, never per-user `userSecret`, never consumer-key signing.
- `read` scope is granted at sign-in (with `openid email` for the user record). `trade` is requested through incremental consent when the user enables investing. `trade` is a partner-only scope granted to the app registered in the SnapTrade dashboard, always alongside `read`, and re-checked by SnapTrade on every trading request.
- Access tokens last 10 hours. Refresh tokens have no fixed expiry and rotate on every refresh; the caller must store the new pair before using it.
- Tokens are stored encrypted at rest by the caller; this package never persists anything.

| Module       | What it does                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pkce.ts`    | Code verifier, S256 challenge, opaque `state`/`nonce` values                                                                      |
| `oauth.ts`   | Endpoint constants, `buildAuthorizeUrl`, `exchangeAuthorizationCode`, `refreshAccessToken`, `revokeRefreshToken`, `verifyIdToken` |
| `client.ts`  | `SnapTradeClient`: connections, accounts, balances, positions, symbol search, quotes, activities, order placement, order list     |
| `schemas.ts` | Zod schemas for the fields of each SnapTrade object the product reads                                                             |
| `errors.ts`  | `SnapTradeApiError`, `SnapTradeOAuthError`, `TradingScopeMissing`                                                                 |

Equity orders go through one call: `POST /trade/place` (`placeOrder`) forwards the order to the brokerage and returns the order record, with the brokerage's verdict as `status`. The caller passes its own UUID as `client_order_id` so a retry cannot place twice. The legacy `/trade/impact` then `/trade/{tradeId}` pair is not used. It requires the `trade` scope; a 403 surfaces as `TradingScopeMissing` so the UI can offer the consent step.
