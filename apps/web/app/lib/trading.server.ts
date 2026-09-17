import {
  accounts,
  and,
  connections,
  eq,
  inArray,
  orderBatches,
  orders,
  type Db,
} from "@noadviceneeded/db";
import {
  SnapTradeApiError,
  TradingScopeMissing,
  type SnapTradeClient,
} from "@noadviceneeded/snaptrade";

import { invalidateSync } from "./portfolio.server.js";

export interface ExecuteLeg {
  accountId: string;
  /** Whole units, or the display estimate when `notionalCents` is set. */
  units: number;
  /** Send the order as this dollar amount instead of units. */
  notionalCents: number | null;
  estimatedCents: number;
}

export interface ExecuteInput {
  kind: "invest" | "withdraw";
  side: "buy" | "sell";
  priceCents: number;
  requestedCents?: number | null;
  symbolId: string;
  ticker: string;
  legs: ExecuteLeg[];
}

export interface ExecuteResult {
  batchId: string;
  placed: number;
  failed: number;
  /** SnapTrade refused because the token lacks `trade`; nothing after that was attempted. */
  scopeMissing: boolean;
}

/**
 * Places one market, day order per leg through SnapTrade's check-then-place
 * pair, recording every step so the Orders page can show exactly what
 * happened. Legs are sized in whole units, or as a dollar amount for
 * fractional accounts. Legs run one at a time; a failure in one never stops
 * the others, except a missing trade scope, which would fail them all the
 * same way.
 */
export async function executeBatch(
  db: Db,
  userId: string,
  client: SnapTradeClient,
  input: ExecuteInput,
  now = new Date(),
): Promise<ExecuteResult> {
  const owned = await db
    .select({ id: accounts.id, snaptradeAccountId: accounts.snaptradeAccountId })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(
      and(
        eq(connections.userId, userId),
        inArray(
          accounts.id,
          input.legs.map((l) => l.accountId),
        ),
      ),
    );
  const snaptradeIdByAccount = new Map(owned.map((a) => [a.id, a.snaptradeAccountId]));

  const [batch] = await db
    .insert(orderBatches)
    .values({
      userId,
      kind: input.kind,
      requestedCents: input.requestedCents ?? null,
      priceCents: input.priceCents,
      ticker: input.ticker,
    })
    .returning({ id: orderBatches.id });
  if (!batch) throw new Error("could not create order batch");

  let placed = 0;
  let failed = 0;
  let scopeMissing = false;

  for (const leg of input.legs) {
    const [row] = await db
      .insert(orders)
      .values({
        batchId: batch.id,
        accountId: leg.accountId,
        side: input.side,
        universalSymbolId: input.symbolId,
        ticker: input.ticker,
        units: leg.units,
        notionalCents: leg.notionalCents,
        estimatedCents: leg.estimatedCents,
        status: "planned",
      })
      .returning({ id: orders.id });
    if (!row) continue;

    const snaptradeAccountId = snaptradeIdByAccount.get(leg.accountId);
    if (scopeMissing || !snaptradeAccountId) {
      failed += 1;
      await db
        .update(orders)
        .set({
          status: "failed",
          error: scopeMissing ? "Not attempted: trading permission missing." : "Account not found.",
        })
        .where(eq(orders.id, row.id));
      continue;
    }

    try {
      const impact = await client.checkOrderImpact({
        account_id: snaptradeAccountId,
        action: input.side === "buy" ? "BUY" : "SELL",
        universal_symbol_id: input.symbolId,
        order_type: "Market",
        time_in_force: "Day",
        ...(leg.notionalCents === null
          ? { units: leg.units, notional_value: null }
          : { units: null, notional_value: leg.notionalCents / 100 }),
      });
      await db
        .update(orders)
        .set({
          snaptradeTradeId: impact.trade.id,
          status: "checked",
          // For a dollar-sized order SnapTrade works out the units; keep its figure over our estimate.
          ...(leg.notionalCents !== null && impact.trade.units != null
            ? { units: impact.trade.units }
            : {}),
        })
        .where(eq(orders.id, row.id));
      const record = await client.placeCheckedOrder(impact.trade.id);
      await db
        .update(orders)
        .set({
          brokerageOrderId: record.brokerage_order_id ?? null,
          status: record.status ?? "PENDING",
          placedAt: now,
        })
        .where(eq(orders.id, row.id));
      placed += 1;
    } catch (error) {
      failed += 1;
      let message = "SnapTrade did not accept the order.";
      if (error instanceof TradingScopeMissing) {
        scopeMissing = true;
        message = "SnapTrade refused: this app does not have trading permission yet.";
      } else if (error instanceof SnapTradeApiError) {
        message = error.detail ?? `SnapTrade responded ${error.status}.`;
      } else if (error instanceof Error) {
        message = error.message;
      }
      await db
        .update(orders)
        .set({ status: "failed", error: message })
        .where(eq(orders.id, row.id));
    }
  }

  // Cash and positions changed; make the next page read SnapTrade again.
  await invalidateSync(db, userId);

  return { batchId: batch.id, placed, failed, scopeMissing };
}
