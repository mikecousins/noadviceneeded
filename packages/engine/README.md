# @noadviceneeded/engine

Pure TypeScript. Every number the product shows about accounts, orders, and room comes from here, so the same input always gives the same answer and every rule has a test. No I/O, no dates from the clock, no dependencies.

Money is integer cents CAD throughout. Units are whole shares.

| Module        | What it does                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `accounts.ts` | Account types, classification from the brokerage's type string, default orders and ranks, copy    |
| `plan.ts`     | `planBuys` (cash in each account to whole units) and `planSells` (an amount to units per account) |
| `room.ts`     | Contribution room left since a user-entered baseline; which account the next deposit goes to      |
| `etfs.ts`     | The curated list of Canadian all-in-one ETFs offered on the ETF page                              |
| `money.ts`    | Cents helpers                                                                                     |
