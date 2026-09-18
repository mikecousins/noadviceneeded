# @noadviceneeded/engine

Pure TypeScript. Every number the product shows about accounts, orders, and room comes from here, so the same input always gives the same answer and every rule has a test. No I/O, no dates from the clock, no dependencies.

Money is integer cents in the country's home currency (CAD or USD). Units are whole shares unless the account is marked fractional, in which case legs carry a dollar amount (`notionalCents`) and units are an estimate.

| Module        | What it does                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `accounts.ts` | Countries, account and room types, classification from the brokerage's type string, default orders    |
| `plan.ts`     | `planBuys` (cash in each account to units or a dollar amount) and `planSells` (an amount per account) |
| `room.ts`     | Contribution room left since a user-entered baseline; which account the next deposit goes to          |
| `etfs.ts`     | The curated list of all-in-one ETFs offered on the ETF page, per country                              |
| `market.ts`   | Whether the country's exchange is open at an instant, with holidays and early closes by rule          |
| `money.ts`    | Cents helpers                                                                                         |
