import { accounts, eq, orders, users } from "@noadviceneeded/db";
import { createTestDb } from "@noadviceneeded/db/testing";
import type {
  SnapTradeClient,
  SnapTradeOrderForm,
  SnapTradeOrderRecord,
  SnapTradeTradeImpact,
} from "@noadviceneeded/snaptrade";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applySnapTradeSnapshot } from "./sync.server.js";
import { executeBatch } from "./trading.server.js";

/** Records every form sent to `/trade/impact` and answers like SnapTrade would. */
function fakeClient(unitsFor: (form: SnapTradeOrderForm) => number | undefined) {
  const forms: SnapTradeOrderForm[] = [];
  const client = {
    async checkOrderImpact(form: SnapTradeOrderForm): Promise<SnapTradeTradeImpact> {
      forms.push(form);
      return { trade: { id: `trade-${forms.length}`, units: unitsFor(form) }, trade_impacts: [] };
    },
    async placeCheckedOrder(tradeId: string): Promise<SnapTradeOrderRecord> {
      return { brokerage_order_id: `bo-${tradeId}`, status: "PENDING" };
    },
  } as unknown as SnapTradeClient;
  return { client, forms };
}

describe("executeBatch", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let userId: string;
  let tfsaId: string;
  let rrspId: string;

  beforeAll(async () => {
    handle = await createTestDb();
    const [u] = await handle.db
      .insert(users)
      .values({ email: "trader@example.ca", snaptradeSubject: "sub-trader" })
      .returning({ id: users.id });
    userId = u!.id;
    await applySnapTradeSnapshot(handle.db, userId, {
      connections: [
        {
          id: "auth-ws",
          name: "Wealthsimple",
          type: "trade",
          disabled: false,
          brokerage: { id: "b1", slug: "WEALTHSIMPLE", name: "Wealthsimple", allows_trading: true },
        },
      ],
      accounts: [
        {
          id: "a-tfsa",
          brokerage_authorization: "auth-ws",
          name: "TFSA",
          number: "****1111",
          institution_name: "Wealthsimple",
          raw_type: "TFSA",
          status: "open",
        },
        {
          id: "a-rrsp",
          brokerage_authorization: "auth-ws",
          name: "RRSP",
          number: "****2222",
          institution_name: "Wealthsimple",
          raw_type: "RRSP",
          status: "open",
        },
      ],
      balances: {},
      positions: {},
      tradeScope: true,
      targetCurrency: "CAD",
      country: "ca",
      now: new Date("2026-09-17T12:00:00Z"),
    });
    const rows = await handle.db.select().from(accounts);
    tfsaId = rows.find((a) => a.snaptradeAccountId === "a-tfsa")!.id;
    rrspId = rows.find((a) => a.snaptradeAccountId === "a-rrsp")!.id;
  });
  afterAll(async () => {
    await handle.close();
  });

  it("sends whole units as units and dollar amounts as notional_value, never both", async () => {
    const { client, forms } = fakeClient((form) =>
      form.notional_value !== null ? 0.9708 : undefined,
    );
    const result = await executeBatch(handle.db, userId, client, {
      kind: "invest",
      side: "buy",
      priceCents: 4_120,
      symbolId: "sym-veqt",
      ticker: "VEQT.TO",
      legs: [
        { accountId: tfsaId, units: 24, notionalCents: null, estimatedCents: 98_880 },
        { accountId: rrspId, units: 0.9709, notionalCents: 4_000, estimatedCents: 4_000 },
      ],
    });
    expect(result).toMatchObject({ placed: 2, failed: 0, scopeMissing: false });

    expect(forms.map((f) => [f.account_id, f.units, f.notional_value])).toEqual([
      ["a-tfsa", 24, null],
      ["a-rrsp", null, 40],
    ]);
    expect(forms.every((f) => f.order_type === "Market" && f.time_in_force === "Day")).toBe(true);

    const placed = await handle.db
      .select()
      .from(orders)
      .where(eq(orders.batchId, result.batchId))
      .orderBy(orders.createdAt);
    expect(placed.map((o) => [o.accountId, o.units, o.notionalCents, o.status])).toEqual([
      [tfsaId, 24, null, "PENDING"],
      // SnapTrade's unit figure for the dollar-sized order replaces the plan's estimate.
      [rrspId, 0.9708, 4_000, "PENDING"],
    ]);
  });

  it("keeps the estimate when SnapTrade reports no units for a dollar-sized order", async () => {
    const { client } = fakeClient(() => undefined);
    const result = await executeBatch(handle.db, userId, client, {
      kind: "withdraw",
      side: "sell",
      priceCents: 4_120,
      requestedCents: 30_000,
      symbolId: "sym-veqt",
      ticker: "VEQT.TO",
      legs: [{ accountId: rrspId, units: 7.2816, notionalCents: 30_000, estimatedCents: 30_000 }],
    });
    const [order] = await handle.db.select().from(orders).where(eq(orders.batchId, result.batchId));
    expect(order).toMatchObject({ units: 7.2816, notionalCents: 30_000, side: "sell" });
  });
});
