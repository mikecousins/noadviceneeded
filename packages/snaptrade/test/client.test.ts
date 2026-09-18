import { describe, expect, it, vi } from "vitest";

import type { SnapTradeApiError } from "../src/index.js";
import { SnapTradeClient, TradingScopeMissing } from "../src/index.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Call = { url: URL; init?: RequestInit };

function clientWith(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: new URL(String(url)), init };
    calls.push(call);
    return handler(call);
  });
  return {
    client: new SnapTradeClient({ accessToken: "at", fetch: fetchMock as unknown as typeof fetch }),
    calls,
  };
}

const veqt = {
  id: "sym-veqt",
  symbol: "VEQT.TO",
  raw_symbol: "VEQT",
  description: "Vanguard All-Equity ETF Portfolio",
  currency: { code: "CAD" },
  exchange: { code: "TSX", suffix: "TO" },
};

describe("SnapTradeClient", () => {
  it("sends only a bearer token, never signing params", async () => {
    const { client, calls } = clientWith(() =>
      jsonResponse([
        {
          id: "conn-1",
          type: "trade",
          disabled: false,
          brokerage: { id: "b1", slug: "WEALTHSIMPLE", name: "Wealthsimple", allows_trading: true },
          extra_upstream_field: "ignored",
        },
      ]),
    );
    const connections = await client.listConnections();
    expect(calls[0]?.url.href).toBe("https://api.snaptrade.com/authorizations");
    expect(new Headers(calls[0]?.init?.headers).get("Authorization")).toBe("Bearer at");
    expect(calls[0]?.url.searchParams.size).toBe(0);
    expect(connections[0]?.brokerage.slug).toBe("WEALTHSIMPLE");
  });

  it("reads balances and positions per account", async () => {
    const { client, calls } = clientWith(({ url }) =>
      url.pathname.endsWith("/balances")
        ? jsonResponse([{ currency: { code: "CAD" }, cash: 1234.56, buying_power: 1234.56 }])
        : jsonResponse([{ symbol: { symbol: veqt }, units: 12, price: 41.2 }]),
    );
    const balances = await client.listBalances("acct-1");
    const positions = await client.listPositions("acct-1");
    expect(calls.map((c) => c.url.pathname)).toEqual([
      "/accounts/acct-1/balances",
      "/accounts/acct-1/positions",
    ]);
    expect(balances[0]?.cash).toBe(1234.56);
    expect(positions[0]?.symbol?.symbol?.symbol).toBe("VEQT.TO");
  });

  it("searches symbols within an account with a JSON body", async () => {
    const { client, calls } = clientWith(() => jsonResponse([veqt]));
    const found = await client.searchAccountSymbols("acct-1", "VEQT");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ substring: "VEQT" });
    expect(found[0]?.id).toBe("sym-veqt");
  });

  it("requests quotes by universal symbol id", async () => {
    const { client, calls } = clientWith(() =>
      jsonResponse([{ symbol: veqt, last_trade_price: 41.25, bid_price: 41.2, ask_price: 41.3 }]),
    );
    const quotes = await client.getQuotes("acct-1", ["sym-veqt"]);
    expect(calls[0]?.url.searchParams.get("symbols")).toBe("sym-veqt");
    expect(calls[0]?.url.searchParams.get("use_ticker")).toBe("false");
    expect(quotes[0]?.last_trade_price).toBe(41.25);
  });

  it("pages activities with query params", async () => {
    const { client, calls } = clientWith(() =>
      jsonResponse({
        data: [{ id: "act-1", type: "CONTRIBUTION", amount: 500, trade_date: "2026-09-01" }],
        pagination: { offset: 0, limit: 100, total: 1 },
      }),
    );
    const page = await client.listActivities("acct-1", {
      startDate: "2026-01-01",
      type: "CONTRIBUTION,WITHDRAWAL",
      offset: 0,
      limit: 100,
    });
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({
      startDate: "2026-01-01",
      type: "CONTRIBUTION,WITHDRAWAL",
      offset: "0",
      limit: "100",
    });
    expect(page.data[0]?.amount).toBe(500);
  });

  it("places an order in one call with the row id as client_order_id", async () => {
    const { client, calls } = clientWith(() =>
      jsonResponse({ brokerage_order_id: "bo-1", status: "PENDING", total_quantity: "3" }),
    );
    const placed = await client.placeOrder({
      account_id: "acct-1",
      action: "BUY",
      universal_symbol_id: "sym-veqt",
      order_type: "Market",
      time_in_force: "Day",
      client_order_id: "0f6d4e2a-0b3f-4a7c-9a1e-5d2c8b7a6f10",
      units: 3,
      notional_value: null,
    });
    expect(calls.map((c) => c.url.pathname)).toEqual(["/trade/place"]);
    expect(JSON.parse(calls[0]?.init?.body as string)).toMatchObject({
      units: 3,
      notional_value: null,
      action: "BUY",
      client_order_id: "0f6d4e2a-0b3f-4a7c-9a1e-5d2c8b7a6f10",
    });
    expect(placed.brokerage_order_id).toBe("bo-1");
    expect(placed.total_quantity).toBe("3");
  });

  it("sends a dollar amount as notional_value with units null", async () => {
    const { client, calls } = clientWith(() =>
      jsonResponse({ brokerage_order_id: "bo-2", status: "ACCEPTED", total_quantity: "0.9708" }),
    );
    const placed = await client.placeOrder({
      account_id: "acct-1",
      action: "BUY",
      universal_symbol_id: "sym-veqt",
      order_type: "Market",
      time_in_force: "Day",
      units: null,
      notional_value: 40,
    });
    expect(JSON.parse(calls[0]?.init?.body as string)).toMatchObject({
      units: null,
      notional_value: 40,
    });
    expect(placed.total_quantity).toBe("0.9708");
  });

  it("turns a 403 on a trading endpoint into TradingScopeMissing", async () => {
    const { client } = clientWith(() => jsonResponse({ detail: "scope" }, 403));
    await expect(
      client.placeOrder({
        account_id: "a",
        action: "BUY",
        universal_symbol_id: "s",
        order_type: "Market",
        time_in_force: "Day",
        units: 1,
        notional_value: null,
      }),
    ).rejects.toBeInstanceOf(TradingScopeMissing);
  });

  it("throws SnapTradeApiError with status, path, and detail on other non-2xx", async () => {
    const { client } = clientWith(() => jsonResponse({ detail: "expired" }, 401));
    await expect(client.listAccounts()).rejects.toMatchObject<Partial<SnapTradeApiError>>({
      status: 401,
      path: "/accounts",
      detail: "expired",
    });
  });
});
