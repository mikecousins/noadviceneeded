import {
  accounts,
  connections,
  eq,
  positions,
  users,
  type Db,
  type User,
} from "@noadviceneeded/db";
import { createTestDb } from "@noadviceneeded/db/testing";
import {
  codeChallengeS256,
  generateCodeVerifier,
  type SnapTradeClient,
  type SnapTradeOrderForm,
  type SnapTradeOrderRecord,
} from "@noadviceneeded/snaptrade";
import { graphql, printSchema } from "graphql";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type * as SnapTradeServer from "../lib/snaptrade.server.js";
import { signHandoffCode } from "../lib/tokens.server.js";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  tradeScope: true,
  client: null as unknown,
}));

vi.mock("../lib/db.server.js", () => ({ getDb: () => state.db }));
vi.mock("../lib/snaptrade.server.js", async (importOriginal) => {
  const real = await importOriginal<typeof SnapTradeServer>();
  return {
    ...real,
    hasTradeScope: async () => state.tradeScope,
    getGrantedScopes: async () => (state.tradeScope ? ["read", "trade"] : ["read"]),
    getSnapTradeClient: async () => {
      if (!state.client) throw new real.SnapTradeReconnectRequired("no token in tests");
      return state.client;
    },
  };
});

const { buildContext, createContext } = await import("./context.server.js");
const { schema } = await import("./schema.server.js");
const { createUserSession } = await import("../lib/session.server.js");

const SECRET = "x".repeat(48);
vi.stubEnv("SNAPTRADE_OAUTH_CLIENT_ID", "client");
vi.stubEnv("SNAPTRADE_OAUTH_CLIENT_SECRET", "secret");
vi.stubEnv("SESSION_SECRET", SECRET);
vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));

/** Thursday 2026-09-24, 11:00 in Toronto: the TSX is open. */
const OPEN = new Date("2026-09-24T15:00:00Z");
/** Saturday. */
const CLOSED = new Date("2026-09-26T15:00:00Z");

function fakeClient() {
  const forms: SnapTradeOrderForm[] = [];
  const client = {
    async getQuotes() {
      return [];
    },
    async placeOrder(form: SnapTradeOrderForm): Promise<SnapTradeOrderRecord> {
      forms.push(form);
      return { brokerage_order_id: `bo-${forms.length}`, status: "PENDING" };
    },
  } as unknown as SnapTradeClient;
  return { client, forms };
}

describe("GraphQL API", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let db: Db;
  let user: User;
  let tfsaId: string;
  let rrspId: string;
  let cashId: string;

  async function run(
    source: string,
    variables: Record<string, unknown> = {},
    options: { now?: Date; signedOut?: boolean; as?: User } = {},
  ) {
    const built = buildContext({
      db,
      user: options.signedOut ? null : (options.as ?? user),
      sessionId: null,
      now: options.now ?? OPEN,
    });
    // Yoga copies the context's properties onto its own object; resolvers
    // never see the one `buildContext` returned.
    const contextValue = Object.assign({}, built);
    return graphql({ schema, source, variableValues: variables, contextValue });
  }

  beforeAll(async () => {
    handle = await createTestDb();
    db = handle.db as unknown as Db;
    state.db = db;
    const [u] = await db
      .insert(users)
      .values({
        email: "app@example.ca",
        snaptradeSubject: "sub-app",
        country: "ca",
        targetSymbolId: "sym-veqt",
        targetTicker: "VEQT.TO",
        targetName: "Vanguard All-Equity ETF Portfolio",
        lastSyncedAt: OPEN,
      })
      .returning();
    user = u!;
    const [c] = await db
      .insert(connections)
      .values({
        userId: user.id,
        snaptradeAuthorizationId: "auth-1",
        brokerageSlug: "WEALTHSIMPLE",
        brokerageName: "Wealthsimple",
        canTrade: true,
      })
      .returning({ id: connections.id });
    const base = { connectionId: c!.id, numberMasked: "****1", statusRaw: "open" };
    const [tfsa, rrsp, cash] = await db
      .insert(accounts)
      .values([
        {
          ...base,
          snaptradeAccountId: "st-tfsa",
          name: "TFSA",
          accountType: "tfsa",
          included: true,
          contributionRank: 1,
          withdrawalRank: 2,
          cashCents: 100_000,
          lastValueCents: 3_000_000_000,
        },
        {
          ...base,
          snaptradeAccountId: "st-rrsp",
          name: "RRSP",
          accountType: "rrsp",
          included: true,
          contributionRank: 2,
          withdrawalRank: 1,
          cashCents: 0,
        },
        {
          ...base,
          snaptradeAccountId: "st-resp",
          name: "RESP",
          accountType: "resp",
          included: false,
          contributionRank: 3,
          withdrawalRank: 3,
          cashCents: 50_000,
        },
      ])
      .returning({ id: accounts.id });
    tfsaId = tfsa!.id;
    rrspId = rrsp!.id;
    cashId = cash!.id;
    await db.insert(positions).values([
      {
        accountId: rrspId,
        universalSymbolId: "sym-veqt",
        ticker: "VEQT.TO",
        units: 30,
        priceCents: 4_000,
      },
    ]);
  });
  afterAll(async () => {
    await handle.close();
  });
  beforeEach(() => {
    state.tradeScope = true;
    state.client = null;
  });

  it("matches the committed schema the iOS app generates from", async () => {
    await expect(printSchema(schema)).toMatchFileSnapshot("../../schema.graphql");
  });

  it("answers null for a signed-out viewer and UNAUTHENTICATED for writes", async () => {
    const read = await run("{ viewer { id } }", {}, { signedOut: true });
    expect(read.errors).toBeUndefined();
    expect(read.data).toEqual({ viewer: null });
    const write = await run("mutation { sync { status } }", {}, { signedOut: true });
    expect(write.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("serves the dashboard from the engine, with totals wider than Int", async () => {
    const { data, errors } = await run(`{
      viewer {
        country countryChosen homeCurrency tradeScope
        fund { ticker }
        portfolio { includedCount totalValueCents cashCents unitsHeld heldValueCents ready { units legs } }
        nextDeposit { account { name } roomCents }
        accounts(order: WITHDRAWAL) { name accountType typeLabel roomType canTrade }
        market { open closedMessage }
      }
    }`);
    expect(errors).toBeUndefined();
    const viewer = data!.viewer as Record<string, unknown>;
    expect(viewer).toMatchObject({
      country: "CA",
      countryChosen: true,
      homeCurrency: "CAD",
      tradeScope: true,
      fund: { ticker: "VEQT.TO" },
      portfolio: {
        includedCount: 2,
        totalValueCents: 3_000_000_000,
        cashCents: 100_000,
        unitsHeld: 30,
        heldValueCents: 120_000,
        ready: { units: 24, legs: 1 },
      },
      nextDeposit: { account: { name: "TFSA" }, roomCents: null },
      market: { open: true, closedMessage: null },
    });
    expect((viewer.accounts as { name: string }[]).map((a) => a.name)).toEqual([
      "RRSP",
      "TFSA",
      "RESP",
    ]);
    expect(viewer.accounts).toContainEqual({
      name: "RRSP",
      accountType: "RRSP",
      typeLabel: "RRSP",
      roomType: "RRSP",
      canTrade: true,
    });
  });

  it("prices the buy and sell plans once per request", async () => {
    const { data, errors } = await run(`{
      viewer {
        quote {
          priceCents source
          buyPlan { totalUnits legs { account { name } units estimatedCostCents } skipped { account { name } reason } }
          sellPlan(amountCents: 50000) { totalProceedsCents shortfallCents legs { account { name } units } }
          sellableCents
        }
      }
    }`);
    expect(errors).toBeUndefined();
    expect((data!.viewer as { quote: unknown }).quote).toMatchObject({
      priceCents: 4_000,
      source: "HOLDING",
      buyPlan: {
        totalUnits: 24,
        legs: [{ account: { name: "TFSA" }, units: 24, estimatedCostCents: 96_000 }],
        skipped: expect.arrayContaining([{ account: { name: "RESP" }, reason: "EXCLUDED" }]),
      },
      sellPlan: {
        totalProceedsCents: 52_000,
        shortfallCents: 0,
        legs: [{ account: { name: "RRSP" }, units: 13 }],
      },
      sellableCents: 120_000,
    });
  });

  it("writes the user's account choices and order, and ignores accounts that are not theirs", async () => {
    const saved = await run(
      `mutation ($accounts: [AccountChoiceInput!]!) {
        updateAccounts(accounts: $accounts) { changed viewer { account(id: "${cashId}") { included fractional } } }
      }`,
      {
        accounts: [
          { accountId: cashId, accountType: "RESP", included: true, fractional: true },
          {
            accountId: "00000000-0000-4000-8000-000000000000",
            accountType: "TFSA",
            included: true,
            fractional: false,
          },
        ],
      },
    );
    expect(saved.errors).toBeUndefined();
    expect(saved.data).toEqual({
      updateAccounts: { changed: 1, viewer: { account: { included: true, fractional: true } } },
    });

    const moved = await run(
      `mutation { moveAccount(accountId: "${rrspId}", order: CONTRIBUTION, direction: UP) {
        accounts(order: CONTRIBUTION) { name }
      } }`,
    );
    expect(moved.errors).toBeUndefined();
    expect(moved.data).toEqual({
      moveAccount: { accounts: [{ name: "RRSP" }, { name: "TFSA" }, { name: "RESP" }] },
    });

    await run(
      `mutation ($accounts: [AccountChoiceInput!]!) { updateAccounts(accounts: $accounts) { changed } }`,
      {
        accounts: [{ accountId: cashId, accountType: "RESP", included: false, fractional: false }],
      },
    );
    await run(
      `mutation { moveAccount(accountId: "${rrspId}", order: CONTRIBUTION, direction: DOWN) { id } }`,
    );
  });

  it("records room for the user's country and suggests from it", async () => {
    const saved = await run(
      `mutation { setRoom(roomType: TFSA, roomCents: 0, asOf: "2026-01-01") {
        room { roomType remainingCents }
        nextDeposit { account { name } }
      } }`,
    );
    expect(saved.errors).toBeUndefined();
    expect(saved.data).toMatchObject({
      setRoom: {
        room: expect.arrayContaining([{ roomType: "TFSA", remainingCents: 0 }]),
        nextDeposit: { account: { name: "RRSP" } },
      },
    });

    const wrongCountry = await run(
      `mutation { setRoom(roomType: HSA, roomCents: 100, asOf: "2026-01-01") { id } }`,
    );
    expect(wrongCountry.errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");

    const cleared = await run(
      `mutation { clearRoom(roomType: TFSA) { nextDeposit { account { name } } } }`,
    );
    expect(cleared.data).toEqual({ clearRoom: { nextDeposit: { account: { name: "TFSA" } } } });
  });

  it("answers a write with the viewer as written", async () => {
    const [fresh] = await db
      .insert(users)
      .values({ email: "new@example.ca", snaptradeSubject: "sub-new" })
      .returning();
    const as = fresh!;
    const confirm = await run(
      `mutation { setCountry(country: CA) { countryChosen country } }`,
      {},
      { as },
    );
    expect(confirm.errors).toBeUndefined();
    expect(confirm.data).toEqual({ setCountry: { countryChosen: true, country: "CA" } });

    await db
      .update(users)
      .set({ targetSymbolId: "sym-veqt", targetTicker: "VEQT.TO", targetName: "VEQT" })
      .where(eq(users.id, as.id));
    const [chosen] = await db.select().from(users).where(eq(users.id, as.id));
    const switched = await run(
      `mutation { setCountry(country: US) { country homeCurrency fund { ticker } } }`,
      {},
      { as: chosen! },
    );
    expect(switched.errors).toBeUndefined();
    expect(switched.data).toEqual({
      setCountry: { country: "US", homeCurrency: "USD", fund: null },
    });
  });

  it("refuses to invest while the exchange is closed", async () => {
    const { client, forms } = fakeClient();
    state.client = client;
    const { errors } = await run("mutation { invest { id } }", {}, { now: CLOSED });
    expect(errors?.[0]?.extensions?.code).toBe("MARKET_CLOSED");
    expect(errors?.[0]?.message).toMatch(/weekend/);
    expect(forms).toHaveLength(0);
  });

  it("refuses without the trade scope or a live grant", async () => {
    state.client = fakeClient().client;
    state.tradeScope = false;
    const scope = await run("mutation { invest { id } }");
    expect(scope.errors?.[0]?.extensions?.code).toBe("TRADE_SCOPE_MISSING");
    state.client = null;
    const grant = await run("mutation { invest { id } }");
    expect(grant.errors?.[0]?.extensions?.code).toBe("RECONNECT_REQUIRED");
  });

  it("places the engine's buy plan and lists the batch", async () => {
    const { client, forms } = fakeClient();
    state.client = client;
    const { data, errors } = await run(`mutation { invest(priceCents: 3900) {
      id kind priceCents orders { accountId accountName side units status brokerageOrderId }
    } }`);
    expect(errors).toBeUndefined();
    expect(forms).toEqual([
      expect.objectContaining({ action: "BUY", units: 24, notional_value: null }),
    ]);
    const batch = data!.invest as { id: string };
    expect(batch).toMatchObject({
      kind: "INVEST",
      priceCents: 4_000,
      orders: [
        {
          accountId: tfsaId,
          accountName: "TFSA",
          side: "BUY",
          units: 24,
          status: "PENDING",
          brokerageOrderId: "bo-1",
        },
      ],
    });

    const listed = await run(
      `query ($id: ID!) { viewer { orderBatches { id } orderBatch(id: $id) { id } } }`,
      {
        id: batch.id,
      },
    );
    expect(listed.data).toEqual({
      viewer: { orderBatches: [{ id: batch.id }], orderBatch: { id: batch.id } },
    });
  });

  it("places the engine's sell plan for an amount", async () => {
    const { client, forms } = fakeClient();
    state.client = client;
    const { data, errors } = await run(
      "mutation { withdraw(amountCents: 50000) { kind requestedCents orders { accountName side units } } }",
    );
    expect(errors).toBeUndefined();
    expect(forms).toEqual([expect.objectContaining({ action: "SELL", units: 13 })]);
    expect(data).toEqual({
      withdraw: {
        kind: "WITHDRAW",
        requestedCents: 50_000,
        orders: [{ accountName: "RRSP", side: "SELL", units: 13 }],
      },
    });
  });

  it("signs the native app in with a PKCE-bound code and a bearer token", async () => {
    const verifier = generateCodeVerifier();
    const code = signHandoffCode(
      { userId: user.id, challenge: await codeChallengeS256(verifier) },
      SECRET,
    );
    const exchange = `mutation ($code: String!, $verifier: String!) {
      exchangeSignInCode(code: $code, codeVerifier: $verifier) { token expiresAt }
    }`;
    const stolen = await run(
      exchange,
      { code, verifier: generateCodeVerifier() },
      { signedOut: true },
    );
    expect(stolen.errors?.[0]?.extensions?.code).toBe("INVALID_CODE");

    const signedIn = await run(exchange, { code, verifier }, { signedOut: true });
    expect(signedIn.errors).toBeUndefined();
    const token = (signedIn.data!.exchangeSignInCode as { token: string }).token;

    const request = new Request("https://app.test/api/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    });
    const ctx = await createContext(request);
    expect(ctx.viewer()?.id).toBe(user.id);

    const out = await graphql({ schema, source: "mutation { signOut }", contextValue: ctx });
    expect(out.data).toEqual({ signOut: true });
    expect((await createContext(request)).viewer()).toBeNull();
  });

  it("honours the browser cookie only on JSON requests", async () => {
    const cookie = (await createUserSession(user.id)).split(";")[0]!;
    const post = (type: string) =>
      new Request("https://app.test/api/graphql", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": type },
      });
    expect((await createContext(post("application/json"))).viewer()?.id).toBe(user.id);
    expect((await createContext(post("text/plain"))).viewer()).toBeNull();
    expect((await createContext(post("application/x-www-form-urlencoded"))).viewer()).toBeNull();
  });
});
