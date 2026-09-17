# Product

## One sentence

Investing is easy if you follow two guidelines, registered accounts first and one all-in-one ETF, and No Advice Needed makes following them across every Canadian brokerage account a single click: it buys the ETF with whatever cash is in each account, sells it when money is needed, and keeps the account order and contribution room straight.

## The two guidelines

1. **Registered accounts first.** Put new money into FHSA, then TFSA, then RRSP, and only then a non-registered account. Take money out in the reverse spirit: non-registered first, RRSP last.
2. **One all-in-one ETF.** Hold the same all-in-one ETF in every account. It is already diversified and already rebalanced, so there is nothing else to pick, weigh, or tune.

That is the whole plan. Both guidelines are widely published and need no advisor to apply; what makes them tedious is applying them by hand across several accounts at one or more brokerages. The app removes the tedium. It does not argue for the guidelines, pick the ETF, choose the amount, or decide the timing; the user does those.

## Who it is for

Canadians who want investing to stay simple: people with a TFSA, an RRSP, maybe an FHSA and a non-registered account, possibly at more than one brokerage, who would rather follow two guidelines than research funds and account rules. They do not need to arrive with a plan. They need the two guidelines applied every time cash lands, without logging into each brokerage, checking which account has cash, remembering which account to fund next, tracking room, and placing the same order in several places.

Not for people looking for a fund pick, a risk questionnaire, or a robo-advisor. The name is the promise: with two guidelines, no advice is needed.

## The flow

1. **Sign in with SnapTrade.** SnapTrade Personal OAuth gives the app read access to the accounts the user chooses to share. The user manages connections at SnapTrade's own dashboard.
2. **Confirm accounts.** The app guesses each account's type from what the brokerage reports (TFSA, RRSP, FHSA, RESP, non-registered, other), the user corrects it once. FHSA, TFSA, RRSP, and non-registered accounts are in the plan by default; RESP, locked-in, and unknown accounts are not.
3. **Pick one ETF.** A curated list of Canadian all-in-one ETFs (Vanguard, iShares, BMO), plus symbol search for anything else the brokerage offers. The choice is stored as a SnapTrade universal symbol id.
4. **Enable trading.** A second SnapTrade consent adds the `trade` scope. Until then everything is read-only and the app says so.
5. **Invest.** When cash is in any included account, the Invest page shows the units each account can buy at the current price (1% held back for market moves; whole units, or fractions to four places for accounts the user marked as fractional) and one button places a market day order in each account through SnapTrade. The Orders page shows what happened.
6. **Next deposit.** The dashboard names the account to fund next: the first account in the contribution order whose type still has room. The user deposits at the brokerage, refreshes, and invests.
7. **Withdraw.** The user enters an amount. The Withdraw page walks accounts in the withdrawal order, sells units (whole, or fractional where marked) until the amount is covered, shows the tax note for each account type, and one button places the sells. The user then moves the cash out at the brokerage.
8. **Room.** For TFSA, RRSP, and FHSA the user enters the room from CRA My Account and the date it was true. Contributions the brokerage reports after that date are subtracted. The figure feeds the next-deposit suggestion and shows on the dashboard.

## Orders

Guideline one, expressed as two orders. Both are preset by account type and both are editable per account with up/down controls.

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
- Household plans (two people, one order).
