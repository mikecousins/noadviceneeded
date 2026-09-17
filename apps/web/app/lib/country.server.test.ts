import { accounts, contributionRoom, eq, users } from "@noadviceneeded/db";
import { createTestDb } from "@noadviceneeded/db/testing";
import type { SnapTradeAccount, SnapTradeConnection } from "@noadviceneeded/snaptrade";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setCountry } from "./country.server.js";
import { setRoomBaseline, updateAccountChoices } from "./portfolio.server.js";
import { roomByType, roomSummary } from "./room.server.js";
import { applySnapTradeSnapshot } from "./sync.server.js";

const fidelity: SnapTradeConnection = {
  id: "auth-fid",
  name: "Fidelity",
  type: "trade",
  disabled: false,
  brokerage: { id: "b1", slug: "FIDELITY", name: "Fidelity", allows_trading: true },
};

function account(
  over: Partial<SnapTradeAccount> & { id: string; raw_type: string },
): SnapTradeAccount {
  return {
    name: over.raw_type,
    number: `****${over.id.slice(-4)}`,
    institution_name: "Fidelity",
    brokerage_authorization: "auth-fid",
    balance: { total: { amount: 1000, currency: "USD" } },
    status: "open",
    ...over,
  };
}

describe("a US user", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let userId: string;
  const t0 = new Date("2026-09-17T12:00:00Z");

  beforeAll(async () => {
    handle = await createTestDb();
    const [u] = await handle.db
      .insert(users)
      .values({ email: "investor@example.com", snaptradeSubject: "sub-us", country: "us" })
      .returning({ id: users.id });
    userId = u!.id;
  });
  afterAll(async () => {
    await handle.close();
  });

  it("gets US types, US defaults and USD cash from the first sync", async () => {
    await applySnapTradeSnapshot(handle.db, userId, {
      connections: [fidelity],
      accounts: [
        account({ id: "a-roth", raw_type: "ROTH_IRA" }),
        account({ id: "a-trad", raw_type: "ROLLOVER_IRA" }),
        account({ id: "a-hsa", raw_type: "HSA" }),
        account({ id: "a-ind", raw_type: "INDIVIDUAL" }),
        account({ id: "a-401k", raw_type: "401K" }),
      ],
      balances: {
        "a-ind": [
          { currency: { code: "USD" }, cash: 250 },
          { currency: { code: "CAD" }, cash: 999 },
        ],
      },
      positions: {},
      tradeScope: true,
      targetCurrency: "USD",
      country: "us",
      now: t0,
    });
    const rows = await handle.db.select().from(accounts);
    const by = (id: string) => rows.find((a) => a.snaptradeAccountId === id)!;
    expect(by("a-roth")).toMatchObject({ accountType: "roth_ira", included: true });
    expect(by("a-trad")).toMatchObject({ accountType: "ira", included: true });
    expect(by("a-hsa")).toMatchObject({ accountType: "hsa", included: true });
    expect(by("a-ind")).toMatchObject({
      accountType: "taxable",
      included: true,
      cashCents: 25_000,
    });
    expect(by("a-401k")).toMatchObject({ accountType: "workplace", included: false });
    // HSA, Roth, Traditional, taxable, workplace for deposits; taxable, Roth, HSA, IRA for withdrawals.
    expect(
      ["a-hsa", "a-roth", "a-trad", "a-ind", "a-401k"].map((id) => by(id).contributionRank),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      ["a-ind", "a-roth", "a-hsa", "a-trad", "a-401k"].map((id) => by(id).withdrawalRank),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("tracks HSA and one shared IRA limit, counting both IRAs against it", async () => {
    await setRoomBaseline(handle.db, userId, "ira", 700_000, "2026-01-01");
    const rows = await handle.db.select().from(accounts);
    const summary = await roomSummary(handle.db, userId, "us", rows);
    expect(summary.map((s) => s.roomType)).toEqual(["hsa", "ira"]);
    expect(summary.find((s) => s.roomType === "ira")).toMatchObject({
      remainingCents: 700_000,
      accountCount: 2,
    });
    expect(summary.find((s) => s.roomType === "hsa")).toMatchObject({
      remainingCents: null,
      accountCount: 1,
    });
    expect(roomByType(summary)).toEqual({ ira: 700_000 });
  });

  it("keeps everything when the same country is confirmed again", async () => {
    const before = await handle.db.select().from(accounts);
    const roth = before.find((a) => a.snaptradeAccountId === "a-roth")!;
    await updateAccountChoices(handle.db, userId, [
      { accountId: roth.id, included: false, fractional: true, accountType: "roth_ira" },
    ]);
    await handle.db.update(users).set({ targetTicker: "AOA", targetSymbolId: "sym-aoa" });

    expect(await setCountry(handle.db, { id: userId, country: "us" }, "us")).toEqual({
      changed: false,
    });
    const after = await handle.db.select().from(accounts);
    expect(after.find((a) => a.id === roth.id)).toMatchObject({
      included: false,
      fractional: true,
      contributionRank: roth.contributionRank,
    });
    const [user] = await handle.db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ country: "us", targetTicker: "AOA" });
  });

  it("starts account setup over when switching country", async () => {
    expect(await setCountry(handle.db, { id: userId, country: "us" }, "ca")).toEqual({
      changed: true,
    });
    const rows = await handle.db.select().from(accounts);
    // Read again as Canadian types: an individual account is non-registered,
    // nothing else Fidelity reports has a Canadian equivalent. All re-ranked.
    const by = (id: string) => rows.find((a) => a.snaptradeAccountId === id)!;
    expect(by("a-ind")).toMatchObject({ accountType: "non_registered", included: true });
    for (const id of ["a-roth", "a-trad", "a-hsa", "a-401k"]) {
      expect(by(id)).toMatchObject({ accountType: "other", included: false });
    }
    expect(rows.map((a) => a.contributionRank).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(rows.map((a) => a.withdrawalRank).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(by("a-ind")).toMatchObject({ contributionRank: 1, withdrawalRank: 1 });
    const [user] = await handle.db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ country: "ca", targetTicker: null, targetSymbolId: null });
    // Room rows are keyed by type and left alone.
    const room = await handle.db.select().from(contributionRoom);
    expect(room.map((r) => r.accountType)).toEqual(["ira"]);
    expect((await roomSummary(handle.db, userId, "ca", rows)).map((s) => s.roomType)).toEqual([
      "tfsa",
      "rrsp",
      "fhsa",
    ]);
  });
});
