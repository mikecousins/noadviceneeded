import { accounts, connections, eq, positions, users } from "@noadviceneeded/db";
import { createTestDb } from "@noadviceneeded/db/testing";
import type { SnapTradeAccount, SnapTradeConnection } from "@noadviceneeded/snaptrade";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applySnapTradeSnapshot, assignMissingRanks } from "./sync.server.js";

const wealthsimple: SnapTradeConnection = {
  id: "auth-ws",
  name: "Wealthsimple",
  type: "trade",
  disabled: false,
  brokerage: { id: "b1", slug: "WEALTHSIMPLE", name: "Wealthsimple", allows_trading: true },
};
const questrade: SnapTradeConnection = {
  id: "auth-qt",
  name: "Questrade",
  type: "read",
  disabled: false,
  brokerage: { id: "b2", slug: "QUESTRADE", name: "Questrade", allows_trading: true },
};

function account(
  over: Partial<SnapTradeAccount> & { id: string; brokerage_authorization: string },
): SnapTradeAccount {
  return {
    name: "Account",
    number: "****1111",
    institution_name: "Wealthsimple",
    raw_type: "TFSA",
    balance: { total: { amount: 1000, currency: "CAD" } },
    status: "open",
    ...over,
  };
}

const veqt = {
  id: "sym-veqt",
  symbol: "VEQT.TO",
  description: "Vanguard All-Equity",
  currency: { code: "CAD" },
};

describe("applySnapTradeSnapshot", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let userId: string;
  const t0 = new Date("2026-09-15T12:00:00Z");

  beforeAll(async () => {
    handle = await createTestDb();
    const [u] = await handle.db
      .insert(users)
      .values({ email: "investor@example.ca", snaptradeSubject: "sub-1" })
      .returning({ id: users.id });
    userId = u!.id;
  });
  afterAll(async () => {
    await handle.close();
  });

  it("inserts connections, classifies accounts, records cash and positions, and ranks everything", async () => {
    const result = await applySnapTradeSnapshot(handle.db, userId, {
      connections: [wealthsimple, questrade],
      accounts: [
        account({
          id: "a-tfsa",
          brokerage_authorization: "auth-ws",
          name: "TFSA",
          raw_type: "TFSA",
        }),
        account({
          id: "a-rrsp",
          brokerage_authorization: "auth-ws",
          name: "RRSP",
          raw_type: "RRSP",
          number: "****2222",
        }),
        account({
          id: "a-lira",
          brokerage_authorization: "auth-qt",
          name: "LIRA",
          raw_type: "LIRA",
          number: "****3333",
        }),
      ],
      balances: {
        "a-tfsa": [
          { currency: { code: "CAD" }, cash: 1234.56 },
          { currency: { code: "USD" }, cash: 99 },
        ],
        "a-rrsp": [{ currency: { code: "USD" }, cash: 50 }],
      },
      positions: {
        "a-tfsa": [{ symbol: { symbol: veqt }, units: 12.5, price: 41.2 }],
      },
      tradeScope: true,
      targetCurrency: "CAD",
      now: t0,
    });
    expect(result).toEqual({ connectionsUpserted: 2, accountsUpserted: 3, connectionsRemoved: 0 });

    const conns = await handle.db.select().from(connections).where(eq(connections.userId, userId));
    expect(conns.find((c) => c.brokerageSlug === "WEALTHSIMPLE")?.canTrade).toBe(true);
    expect(conns.find((c) => c.brokerageSlug === "QUESTRADE")?.canTrade).toBe(false);

    const rows = await handle.db.select().from(accounts);
    const tfsa = rows.find((a) => a.snaptradeAccountId === "a-tfsa")!;
    const rrsp = rows.find((a) => a.snaptradeAccountId === "a-rrsp")!;
    const lira = rows.find((a) => a.snaptradeAccountId === "a-lira")!;
    expect(tfsa).toMatchObject({
      accountType: "tfsa",
      included: true,
      cashCents: 123_456,
      lastValueCents: 100_000,
    });
    // USD-only cash does not count toward a CAD ETF.
    expect(rrsp).toMatchObject({ accountType: "rrsp", included: true, cashCents: 0 });
    expect(lira).toMatchObject({ accountType: "other", included: false, cashCents: null });
    // Default orders: TFSA before RRSP for contributions; withdrawals: TFSA, RRSP, other.
    expect([tfsa.contributionRank, rrsp.contributionRank, lira.contributionRank]).toEqual([
      1, 2, 3,
    ]);
    expect([tfsa.withdrawalRank, rrsp.withdrawalRank, lira.withdrawalRank]).toEqual([1, 2, 3]);

    const held = await handle.db.select().from(positions).where(eq(positions.accountId, tfsa.id));
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({
      universalSymbolId: "sym-veqt",
      ticker: "VEQT.TO",
      units: 12.5,
      priceCents: 4_120,
    });
  });

  it("keeps the user's type, inclusion, and order on a later sync, and appends new accounts", async () => {
    const rows = await handle.db.select().from(accounts);
    const tfsa = rows.find((a) => a.snaptradeAccountId === "a-tfsa")!;
    const rrsp = rows.find((a) => a.snaptradeAccountId === "a-rrsp")!;
    // The user swaps the contribution order and takes the RRSP out of the plan.
    await handle.db.update(accounts).set({ contributionRank: 2 }).where(eq(accounts.id, tfsa.id));
    await handle.db
      .update(accounts)
      .set({ contributionRank: 1, included: false, accountType: "non_registered" })
      .where(eq(accounts.id, rrsp.id));

    const t1 = new Date("2026-09-16T12:00:00Z");
    await applySnapTradeSnapshot(handle.db, userId, {
      connections: [wealthsimple],
      accounts: [
        account({
          id: "a-tfsa",
          brokerage_authorization: "auth-ws",
          name: "TFSA renamed",
          raw_type: "TFSA",
          balance: { total: { amount: 1500, currency: "CAD" } },
        }),
        account({
          id: "a-rrsp",
          brokerage_authorization: "auth-ws",
          name: "RRSP",
          raw_type: "RRSP",
          number: "****2222",
        }),
        account({
          id: "a-fhsa",
          brokerage_authorization: "auth-ws",
          name: "FHSA",
          raw_type: "FHSA",
          number: "****4444",
        }),
      ],
      balances: { "a-fhsa": [{ currency: { code: "CAD" }, cash: 8000 }] },
      positions: { "a-tfsa": [] },
      tradeScope: true,
      targetCurrency: "CAD",
      now: t1,
    });

    const after = await handle.db.select().from(accounts);
    const tfsa2 = after.find((a) => a.snaptradeAccountId === "a-tfsa")!;
    const rrsp2 = after.find((a) => a.snaptradeAccountId === "a-rrsp")!;
    const fhsa = after.find((a) => a.snaptradeAccountId === "a-fhsa")!;
    expect(tfsa2).toMatchObject({
      name: "TFSA renamed",
      lastValueCents: 150_000,
      contributionRank: 2,
      included: true,
    });
    // Cash was not read this time, so the previous figure stays.
    expect(tfsa2.cashCents).toBe(123_456);
    expect(rrsp2).toMatchObject({
      accountType: "non_registered",
      included: false,
      contributionRank: 1,
    });
    expect(fhsa).toMatchObject({
      accountType: "fhsa",
      included: true,
      cashCents: 800_000,
      contributionRank: 4,
      withdrawalRank: 4,
    });

    // Positions were read as empty, so the old one is gone.
    const held = await handle.db.select().from(positions).where(eq(positions.accountId, tfsa2.id));
    expect(held).toHaveLength(0);

    const conns = await handle.db.select().from(connections).where(eq(connections.userId, userId));
    expect(conns.find((c) => c.brokerageSlug === "QUESTRADE")?.status).toBe("removed");
  });

  it("assignMissingRanks is a no-op once everything is ranked", async () => {
    const before = await handle.db.select().from(accounts);
    await assignMissingRanks(handle.db, userId);
    const after = await handle.db.select().from(accounts);
    expect(after.map((a) => [a.id, a.contributionRank, a.withdrawalRank])).toEqual(
      before.map((a) => [a.id, a.contributionRank, a.withdrawalRank]),
    );
  });
});
