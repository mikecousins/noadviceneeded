# Product

## One sentence

Investing is easy if you follow two guidelines, registered accounts first and one all-in-one ETF, and No Advice Needed makes following them across every Canadian or US brokerage account a single click: it buys the ETF with whatever cash is in each account, sells it when money is needed, and keeps the account order and contribution room straight.

## The two guidelines

1. **Registered accounts first.** In Canada, put new money into FHSA, then TFSA, then RRSP, and only then a non-registered account; in the US, HSA, then Roth IRA, then Traditional IRA, then taxable. Take money out in the reverse spirit: the unsheltered account first, the deductible one last.
2. **One all-in-one ETF.** Hold the same all-in-one ETF in every account. It is already diversified and already rebalanced, so there is nothing else to pick, weigh, or tune.

That is the whole plan. Both guidelines are widely published and need no advisor to apply; what makes them tedious is applying them by hand across several accounts at one or more brokerages. The app removes the tedium. It does not argue for the guidelines, pick the ETF, choose the amount, or decide the timing; the user does those.

## Who it is for

Canadians and Americans who want investing to stay simple: people with a TFSA, an RRSP, maybe an FHSA and a non-registered account, or a Roth IRA, an HSA and a taxable account, possibly at more than one brokerage, who would rather follow two guidelines than research funds and account rules. They do not need to arrive with a plan. They need the two guidelines applied every time cash lands, without logging into each brokerage, checking which account has cash, remembering which account to fund next, tracking room, and placing the same order in several places.

Not for people looking for a fund pick, a risk questionnaire, or a robo-advisor. The name is the promise: with two guidelines, no advice is needed.

## The flow

1. **Sign in with SnapTrade.** SnapTrade Personal OAuth gives the app read access to the accounts the user chooses to share. The user manages connections at SnapTrade's own dashboard.
2. **Pick a country.** Canada or the United States, asked once on the first visit and changeable from the header. It decides the account types, the limits room is tracked for, the home currency and the curated ETF list. Switching starts account setup over.
3. **Confirm accounts.** The app guesses each account's type from what the brokerage reports (Canada: TFSA, RRSP, FHSA, RESP, non-registered, other; US: HSA, Roth IRA, Traditional IRA, taxable, workplace, 529, other), the user corrects it once. The contribution-eligible types are in the plan by default; RESP, 529, workplace, locked-in, and unknown accounts are not.
4. **Pick one ETF.** A curated list of all-in-one ETFs (Canada: Vanguard, iShares, BMO asset-allocation ETFs; US: Vanguard Total World and the iShares Core Allocation series), plus symbol search for anything else the brokerage offers. The choice is stored as a SnapTrade universal symbol id.
5. **Enable trading.** A second SnapTrade consent adds the `trade` scope. Until then everything is read-only and the app says so.
6. **Invest.** When cash is in any included account, the Invest page shows the units each account can buy at the current price (1% held back for market moves; whole units, or fractions to four places for accounts the user marked as fractional) and one button places a market day order in each account through SnapTrade. The Orders page shows what happened.
7. **Next deposit.** The dashboard names the account to fund next: the first account in the contribution order whose limit still has room. The user deposits at the brokerage, refreshes, and invests.
8. **Withdraw.** The user enters an amount. The Withdraw page walks accounts in the withdrawal order, sells units (whole, or fractional where marked) until the amount is covered, shows the tax note for each account type, and one button places the sells. The user then moves the cash out at the brokerage.
9. **Room.** For TFSA, RRSP, and FHSA the user enters the room from CRA My Account and the date it was true; for an HSA and for the IRA limit (shared by a Traditional and a Roth IRA) they enter this year's limit less what they have already put in. Contributions the brokerage reports after that date are subtracted. The figure feeds the next-deposit suggestion and shows on the dashboard.

## Orders

Guideline one, expressed as two orders. Both are preset by account type and both are editable per account with up/down controls.

| Purpose                          | Default order                           | Why                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where new cash goes (Canada)     | FHSA, TFSA, RRSP, non-registered        | FHSA is deductible in and tax-free out for a first home; TFSA is tax-free with no strings; RRSP is deductible but taxed later; non-registered has no shelter                               |
| Where withdrawals come from (CA) | non-registered, TFSA, FHSA, RRSP        | Non-registered loses no room; TFSA room returns next January; an FHSA withdrawal outside a home purchase is taxed and room is gone; RRSP is taxed at source and room is gone               |
| Where new cash goes (US)         | HSA, Roth IRA, Traditional IRA, taxable | HSA is deductible in and tax-free out for medical costs; Roth is tax-free growth; Traditional is deductible but taxed later; taxable has no shelter                                        |
| Where withdrawals come from (US) | taxable, Roth IRA, HSA, Traditional IRA | Taxable loses no room; Roth contributions come out untaxed; an HSA withdrawal outside medical costs is taxed and penalised; a Traditional IRA withdrawal is taxed and penalised before 59½ |

The app explains the defaults in one line each and never argues with an override.

## What the app does not do

- Move cash between accounts or to a bank. SnapTrade has no transfer API; the user does this at the brokerage.
- Choose the fund, the amount, or the timing. The user does.
- Rebalance, harvest losses, or hold more than one security per plan.
- Model taxes, projections, or retirement. Room is a running count, not a forecast.
- Track workplace plans (401(k) and the like). They are funded through payroll and usually hold plan funds, so they sit out of the plan unless the user includes one.

## Later

- iOS app as a thin client over the same loaders once the API shape settles.
- Notifications when cash lands (needs SnapTrade webhooks, a partner-only scope).
- Household plans (two people, one order).
