import type { Db, User } from "@noadviceneeded/db";
import { planBuys, planSells } from "@noadviceneeded/engine";

import { effectiveCountry } from "./country.js";
import { marketClosedCopy, marketView } from "./market.js";
import { resolvePrice } from "./plan.server.js";
import { buildPlanAccounts } from "./portfolio.server.js";
import { getSnapTradeClient, hasTradeScope } from "./snaptrade.server.js";
import { executeBatch } from "./trading.server.js";

export type PlaceErrorCode =
  | "NO_FUND"
  | "RECONNECT_REQUIRED"
  | "TRADE_SCOPE_MISSING"
  | "MARKET_CLOSED"
  | "NO_PRICE"
  | "NOTHING_TO_TRADE";

export interface PlaceRefusal {
  ok: false;
  code: PlaceErrorCode;
  message: string;
}

export type PlaceOutcome = { ok: true; batchId: string } | PlaceRefusal;

type Trader = Pick<User, "id" | "country" | "targetSymbolId" | "targetTicker">;

function refused(code: PlaceErrorCode, message: string): PlaceRefusal {
  return { ok: false, code, message };
}

/**
 * Everything both batches check before anything reaches the brokerage: a
 * fund, a live SnapTrade grant with `trade`, and an open exchange (D-017), so
 * nothing sits in a queue overnight to fill at whatever the open brings. Then
 * the plan is rebuilt from the database and priced from a fresh quote if one
 * is available, otherwise the price the user confirmed.
 */
async function prepare(db: Db, user: Trader, shownPriceCents: number | null, now: Date) {
  if (!user.targetSymbolId || !user.targetTicker) {
    return refused("NO_FUND", "Choose a fund first.");
  }
  let client;
  try {
    client = await getSnapTradeClient(user.id);
  } catch {
    return refused(
      "RECONNECT_REQUIRED",
      "Your SnapTrade access has ended. Sign in again to reconnect.",
    );
  }
  const tradeScope = await hasTradeScope(user.id);
  if (!tradeScope) {
    return refused(
      "TRADE_SCOPE_MISSING",
      "Enable trading at SnapTrade first (see the banner above).",
    );
  }
  const market = marketView(effectiveCountry(user), now);
  if (!market.open) return refused("MARKET_CLOSED", marketClosedCopy(market));
  const accounts = await buildPlanAccounts(db, user.id, {
    targetSymbolId: user.targetSymbolId,
    tradeScope,
  });
  const price =
    (await resolvePrice(client, user.targetSymbolId, accounts, { now }))?.priceCents ??
    (shownPriceCents && shownPriceCents > 0 ? shownPriceCents : null);
  if (!price) return refused("NO_PRICE", "No price is available to size the orders.");
  return {
    ok: true as const,
    client,
    accounts,
    priceCents: price,
    symbolId: user.targetSymbolId,
    ticker: user.targetTicker,
  };
}

/** Invest: one market day buy per included account with cash, from the engine's plan. */
export async function placeInvestBatch(
  db: Db,
  user: Trader,
  options: { shownPriceCents: number | null; now?: Date },
): Promise<PlaceOutcome> {
  const now = options.now ?? new Date();
  const ready = await prepare(db, user, options.shownPriceCents, now);
  if (!ready.ok) return ready;
  const plan = planBuys(ready.accounts, { priceCents: ready.priceCents });
  if (plan.legs.length === 0) {
    return refused("NOTHING_TO_TRADE", "There is nothing to buy right now.");
  }
  const result = await executeBatch(
    db,
    user.id,
    ready.client,
    {
      kind: "invest",
      side: "buy",
      priceCents: ready.priceCents,
      symbolId: ready.symbolId,
      ticker: ready.ticker,
      legs: plan.legs.map((l) => ({
        accountId: l.accountId,
        units: l.units,
        notionalCents: l.notionalCents,
        estimatedCents: l.estimatedCostCents,
      })),
    },
    now,
  );
  return { ok: true, batchId: result.batchId };
}

/** Withdraw: sells in withdrawal order until `amountCents` is covered, from the engine's plan. */
export async function placeWithdrawBatch(
  db: Db,
  user: Trader,
  options: { amountCents: number; shownPriceCents: number | null; now?: Date },
): Promise<PlaceOutcome> {
  const now = options.now ?? new Date();
  const ready = await prepare(db, user, options.shownPriceCents, now);
  if (!ready.ok) return ready;
  const plan = planSells(ready.accounts, {
    amountCents: options.amountCents,
    priceCents: ready.priceCents,
  });
  if (plan.legs.length === 0) {
    return refused("NOTHING_TO_TRADE", "No included account holds units to sell.");
  }
  const result = await executeBatch(
    db,
    user.id,
    ready.client,
    {
      kind: "withdraw",
      side: "sell",
      priceCents: ready.priceCents,
      requestedCents: options.amountCents,
      symbolId: ready.symbolId,
      ticker: ready.ticker,
      legs: plan.legs.map((l) => ({
        accountId: l.accountId,
        units: l.units,
        notionalCents: l.notionalCents,
        estimatedCents: l.estimatedProceedsCents,
      })),
    },
    now,
  );
  return { ok: true, batchId: result.batchId };
}
