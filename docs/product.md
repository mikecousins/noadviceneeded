# Product

## One sentence

For Canadians who already know they want one all-in-one ETF, No Advice Needed connects every brokerage account, buys that ETF with whatever cash is sitting in each account, sells it when they need money, and keeps the account order and contribution room straight so they never have to think about it.

## Who it is for

Self-directed investors with more than one account (a TFSA, an RRSP, maybe an FHSA and a non-registered account, possibly at more than one brokerage) who have settled on a single all-in-one ETF and find the remaining chores tedious: logging into each brokerage, checking which account has cash, remembering which account to fund next, tracking room, placing the same order in several places.

Not for people looking for a fund pick, a risk questionnaire, or a robo-advisor. The name is the promise.

## The flow

1. **Sign in with SnapTrade.** SnapTrade Personal OAuth gives the app read access to the accounts the user chooses to share. The user manages connections at SnapTrade's own dashboard.
2. **Confirm accounts.** The app guesses each account's type from what the brokerage reports (TFSA, RRSP, FHSA, RESP, non-registered, other), the user corrects it once. FHSA, TFSA, RRSP, and non-registered accounts are in the plan by default; RESP, locked-in, and unknown accounts are not.
3. **Pick one ETF.** A curated list of Canadian all-in-one ETFs (Vanguard, iShares, BMO), plus symbol search for anything else the brokerage offers. The choice is stored as a SnapTrade universal symbol id.
4. **Enable trading.** A second SnapTrade consent adds the `trade` scope. Until then everything is read-only and the app says so.
5. **Invest.** When cash is in any included account, the Invest page shows the whole units each account can buy at the current price (1% held back for market moves) and one button places a market day order in each account through SnapTrade. The Orders page shows what happened.
6. **Next deposit.** The dashboard names the account to fund next: the first account in the contribution order whose type still has room. The user deposits at the brokerage, refreshes, and invests.
7. **Withdraw.** The user enters an amount. The Withdraw page walks accounts in the withdrawal order, sells whole units until the amount is covered, shows the tax note for each account type, and one button places the sells. The user then moves the cash out at the brokerage.
8. **Room.** For TFSA, RRSP, and FHSA the user enters the room from CRA My Account and the date it was true. Contributions the brokerage reports after that date are subtracted. The figure feeds the next-deposit suggestion and shows on the dashboard.

## Orders

Two orders, both preset by account type and both editable per account with up/down controls.

| Purpose                     | Default order                    | Why                                                                                                                                                                          |
| --------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where new cash goes         | FHSA, TFSA, RRSP, non-registered | FHSA is deductible in and tax-free out for a first home; TFSA is tax-free with no strings; RRSP is deductible but taxed later; non-registered has no shelter                 |
| Where withdrawals come from | non-registered, TFSA, FHSA, RRSP | Non-registered loses no room; TFSA room returns next January; an FHSA withdrawal outside a home purchase is taxed and room is gone; RRSP is taxed at source and room is gone |

The app explains the defaults in one line each and never argues with an override.

## What the app does not do

- Move cash between accounts or to a bank. SnapTrade has no transfer API; the user does this at the brokerage.
- Choose the fund, the amount, or the timing. The user does.
- Rebalance, harvest losses, or hold more than one security per plan.
- Model taxes, projections, or retirement. Room is a running count, not a forecast.
- Support US accounts yet. Types, room, and copy are Canadian.

## Later

- US users: account types (401k, IRA, Roth, taxable), room rules, US-listed all-in-ones.
- iOS app as a thin client over the same loaders once the API shape settles.
- Notifications when cash lands (needs SnapTrade webhooks, a partner-only scope).
- Fractional units where the brokerage supports them.
- Household plans (two people, one order).
