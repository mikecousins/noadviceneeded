# No Advice Needed for iOS

A thin SwiftUI client over the web app's GraphQL API (`/api/graphql`, D-019). Every plan, room figure and order check is computed on the server; the app renders what the API returns and asks the user to confirm each batch. iOS 17+, SwiftUI, Swift concurrency, Apollo iOS 2.

## Setup

Requires Xcode 26 or later and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).

```bash
cd apps/ios
xcodegen generate
open NoAdviceNeeded.xcodeproj
```

`project.yml` is the source of the project; the generated `NoAdviceNeeded.xcodeproj` is not committed. Run `xcodegen generate` again after adding or removing files. Swift packages (Apollo iOS, pinned to 2.4.0) resolve on first build.

Run the `NoAdviceNeeded` scheme on a simulator. Tests:

```bash
xcodebuild -project NoAdviceNeeded.xcodeproj -scheme NoAdviceNeeded -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## Configuration

The API base URL is set per build configuration and read from `Info.plist` (`APIBaseURL`):

| Configuration | `API_BASE_URL`              | File                      |
| ------------- | --------------------------- | ------------------------- |
| Debug         | `http://localhost:5173`     | `Config/Debug.xcconfig`   |
| Release       | `https://noadviceneeded.ca` | `Config/Release.xcconfig` |

To point a build somewhere else (your Mac's LAN address for a real device, a branch deploy), create `Config/Local.xcconfig`, which git ignores and both configurations include last:

```
API_BASE_URL = http:/$()/192.168.1.20:5173
```

(`$()` keeps the `//` from starting an xcconfig comment.) Signing is automatic; set `DEVELOPMENT_TEAM` in the same file to run on a device. Local `http://` is allowed through `NSAllowsLocalNetworking`; everything else needs https.

## Sign-in

1. The app generates a PKCE verifier and S256 challenge (`Auth/PKCE.swift`).
2. It opens `<base>/auth/snaptrade/mobile?code_challenge=…` in a web authentication session (`&scope=trade` for "Enable trading").
3. The session ends at `noadviceneeded://auth/callback?code=…` or `?error=<reason>` (`Auth/SignInFlow.swift`). The `noadviceneeded` scheme is registered in `Info.plist`.
4. `exchangeSignInCode(code:codeVerifier:)` returns a bearer token, kept in the Keychain (`Auth/TokenStore.swift`, this device only) and sent as `Authorization: Bearer` on every request.
5. An `UNAUTHENTICATED` error, or a null `viewer`, drops the token and shows sign-in. Sign out calls `signOut` to revoke the session. Tokens last 30 days.

Against a local `pnpm dev`, sign-in needs the four values in the repo's `.env` and a SnapTrade OAuth app that lists `http://localhost:5173/auth/snaptrade/callback`.

### Without SnapTrade (Debug builds only)

To look at screens against a seeded local database without a SnapTrade login, a Debug build reads two launch environment variables:

- `NAN_SESSION_TOKEN`: a bearer token (`<sessions.id>.<HMAC-SHA256(SESSION_SECRET, "session:<id>") base64url>`, see `signSessionToken` in `apps/web/app/lib/tokens.server.ts`), saved to the Keychain at launch.
- `NAN_SCREEN`: `invest`, `withdraw`, `orders`, `plan`, `accounts`, `fund`, `room` or `country`, opened at launch.

```bash
SIMCTL_CHILD_NAN_SESSION_TOKEN=<token> SIMCTL_CHILD_NAN_SCREEN=room xcrun simctl launch booted ca.noadviceneeded.app
```

Release builds never read either.

## Codegen

Swift models and operations are generated with Apollo iOS codegen from the committed schema, `apps/web/schema.graphql`. Operations live in `NoAdviceNeeded/GraphQL/Operations/*.graphql`; the output in `NoAdviceNeeded/GraphQL/Generated` is committed so a fresh clone builds without the CLI.

After changing an operation, or after the server's schema changes (`pnpm --filter web test -u` rewrites `schema.graphql`):

```bash
cd apps/ios
curl -sL https://github.com/apollographql/apollo-ios/releases/download/2.4.0/apollo-ios-cli.tar.gz | tar xz
./apollo-ios-cli generate
rm apollo-ios-cli
```

Keep the CLI version equal to the Apollo package version in `project.yml`. The configuration is `apollo-codegen-config.json`; everything lands in the `API` namespace (`API.HomeQuery`, `API.AccountType`).

Custom scalars are mapped in `Generated/Schema/CustomScalars`, which codegen creates once and never overwrites:

| Scalar     | Swift                                      |
| ---------- | ------------------------------------------ |
| `Cents`    | `Int` (64-bit integer cents)               |
| `DateTime` | `Foundation.Date` (ISO 8601, milliseconds) |
| `Date`     | `CalendarDay` (`YYYY-MM-DD`, Eastern time) |

## Layout

```
App/        entry point, AppModel (session, sync, tabs), shared views, per-country copy
API/        AppConfig, APIClient (Apollo + bearer token), APIError (extensions.code)
Auth/       PKCE, Keychain token store, sign-in URLs and callback
Design/     Acid Ledger tokens (Theme), account-type ramp (Tiers), primitives, money formatting
Screens/    Home, Invest, Withdraw, Orders, Plan, Accounts, Fund, Room, Country, Sign in
GraphQL/    operations (.graphql) and generated Swift
```

The app mirrors the web routes in `apps/web/app/routes/app*.tsx` and follows the same product rules: two guidelines, no "recommend", "should" or "best", orders only on the user's confirmation per batch, cash never moves between accounts.

- **Sync.** `sync(force: false)` on launch and `sync(force: true)` on pull to refresh; queries only read the database. `SyncPayload.status` shows under each screen's header; `RECONNECT` offers sign-in again.
- **Errors.** Coded refusals (`MARKET_CLOSED`, `TRADE_SCOPE_MISSING`, `RECONNECT_REQUIRED`, `NO_PRICE`, `NOTHING_TO_TRADE`, `NO_FUND`, `NO_BROKERAGE`, `SYMBOL_NOT_FOUND`, `INVALID_CODE`, `BAD_USER_INPUT`) show the server's message as written, with the one action that answers it (Enable trading, Sign in again, Choose a fund).
- **Design.** Colours, type and radii come from `apps/web/app/app.css` into `Design/Theme.swift`; the account-type ramp from `apps/web/app/lib/tiers.ts` into `Design/Tiers.swift`. The web's font stacks end in the system faces, which the app uses (SF for display and body, SF Mono for labels and numbers). Money formats through `\.money`, bound to the user's home currency, so home is a bare "$" and anything else is prefixed (`Design/Format.swift`, ported from `apps/web/app/lib/format.ts`).
