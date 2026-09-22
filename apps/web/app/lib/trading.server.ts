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
  /** SnapTrade refused at least one leg because the token lacks `trade`. */
  scopeMissing: boolean;
}

type LegOutcome = "placed" | "failed" | "scope_missing";

/**
 * Places one market, day order per leg through SnapTrade's `POST /trade/place`,
 * recording what came back so the Orders page can show exactly what
 * happened. Legs are sized in whole units, or as a dollar amount for
 * fractional accounts. The rows are created in plan order, then every leg
 * runs at once: each is its own account, so one brokerage rejection never
 * touches the others, and a batch across many accounts takes about as long
 * as one leg instead of tripping the request timeout.
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

  // One insert per leg, in order, so the Orders page lists them as planned.
  const rows: { orderId: string; leg: ExecuteLeg }[] = [];
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
    if (row) rows.push({ orderId: row.id, leg });
  }

  const outcomes = await Promise.all(
    rows.map(({ orderId, leg }) =>
      placeLeg(db, client, input, orderId, leg, snaptradeIdByAccount.get(leg.accountId), now),
    ),
  );

  // Cash and positions changed; make the next page read SnapTrade again.
  await invalidateSync(db, userId);

  return {
    batchId: batch.id,
    placed: outcomes.filter((o) => o === "placed").length,
    failed: outcomes.filter((o) => o !== "placed").length,
    scopeMissing: outcomes.includes("scope_missing"),
  };
}

/** SnapTrade reports quantities as decimal strings; read one as a number, or null when absent. */
function quantityOf(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Places one leg and writes the outcome to its order row. Never throws. */
async function placeLeg(
  db: Db,
  client: SnapTradeClient,
  input: ExecuteInput,
  orderId: string,
  leg: ExecuteLeg,
  snaptradeAccountId: string | undefined,
  now: Date,
): Promise<LegOutcome> {
  if (!snaptradeAccountId) {
    await db
      .update(orders)
      .set({ status: "failed", error: "Account not found." })
      .where(eq(orders.id, orderId));
    return "failed";
  }

  try {
    const record = await client.placeOrder({
      account_id: snaptradeAccountId,
      action: input.side === "buy" ? "BUY" : "SELL",
      universal_symbol_id: input.symbolId,
      order_type: "Market",
      time_in_force: "Day",
      // Our row id doubles as SnapTrade's idempotency key, so a retried request cannot place twice.
      client_order_id: orderId,
      ...(leg.notionalCents === null
        ? { units: leg.units, notional_value: null }
        : { units: null, notional_value: leg.notionalCents / 100 }),
    });
    const reportedUnits = quantityOf(record.total_quantity);
    await db
      .update(orders)
      .set({
        brokerageOrderId: record.brokerage_order_id ?? null,
        status: record.status ?? "PENDING",
        placedAt: now,
        // For a dollar-sized order SnapTrade works out the units; keep its figure over our estimate.
        ...(leg.notionalCents !== null && reportedUnits !== null ? { units: reportedUnits } : {}),
      })
      .where(eq(orders.id, orderId));
    return "placed";
  } catch (error) {
    let message = "SnapTrade did not accept the order.";
    let outcome: LegOutcome = "failed";
    if (error instanceof TradingScopeMissing) {
      outcome = "scope_missing";
      message = "SnapTrade refused: this app does not have trading permission yet.";
    } else if (error instanceof SnapTradeApiError) {
      message = error.detail ?? `SnapTrade responded ${error.status}.`;
    } else if (error instanceof Error) {
      message = error.message;
    }
    await db.update(orders).set({ status: "failed", error: message }).where(eq(orders.id, orderId));
    return outcome;
  }
}
