import { z } from "zod";

import { SnapTradeApiError, TradingScopeMissing } from "./errors.js";
import { SNAPTRADE_API_BASE } from "./oauth.js";
import {
  SnapTradeAccount,
  SnapTradeBalance,
  SnapTradeConnection,
  SnapTradeOrderRecord,
  SnapTradePaginatedActivities,
  SnapTradePosition,
  SnapTradeQuote,
  SnapTradeUniversalSymbol,
  type SnapTradeOrderForm,
} from "./schemas.js";

export interface SnapTradeClientOptions {
  /** A live OAuth access token. Refreshing is the caller's job. */
  accessToken: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}

type Query = Record<string, string | number | undefined>;

/**
 * Bearer-token client over the SnapTrade REST API. No `clientId`,
 * `consumerKey`, `userId`, `userSecret`, or request signature is ever sent:
 * on an OAuth request SnapTrade resolves the user from the token.
 */
export class SnapTradeClient {
  readonly #accessToken: string;
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;

  constructor(options: SnapTradeClientOptions) {
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetch ?? fetch;
    this.#baseUrl = options.baseUrl ?? SNAPTRADE_API_BASE;
  }

  /** Every brokerage connection the user has shared with this app. */
  listConnections(): Promise<SnapTradeConnection[]> {
    return this.#request("GET", "/authorizations", z.array(SnapTradeConnection));
  }

  /** Every account across every connection. */
  listAccounts(): Promise<SnapTradeAccount[]> {
    return this.#request("GET", "/accounts", z.array(SnapTradeAccount));
  }

  /** Cash per currency in one account. */
  listBalances(accountId: string): Promise<SnapTradeBalance[]> {
    return this.#request("GET", `/accounts/${enc(accountId)}/balances`, z.array(SnapTradeBalance));
  }

  /** Stock/ETF positions in one account. */
  listPositions(accountId: string): Promise<SnapTradePosition[]> {
    return this.#request(
      "GET",
      `/accounts/${enc(accountId)}/positions`,
      z.array(SnapTradePosition),
    );
  }

  /** Symbols tradable in this account that match the substring. */
  searchAccountSymbols(accountId: string, substring: string): Promise<SnapTradeUniversalSymbol[]> {
    return this.#request(
      "POST",
      `/accounts/${enc(accountId)}/symbols`,
      z.array(SnapTradeUniversalSymbol),
      { body: { substring } },
    );
  }

  /**
   * Latest brokerage quotes for up to 10 universal symbol ids. May be delayed
   * and is disabled on some SnapTrade plans; callers must have a fallback.
   */
  getQuotes(accountId: string, universalSymbolIds: string[]): Promise<SnapTradeQuote[]> {
    return this.#request("GET", `/accounts/${enc(accountId)}/quotes`, z.array(SnapTradeQuote), {
      query: { symbols: universalSymbolIds.join(","), use_ticker: "false" },
    });
  }

  /** Recent orders in one account. */
  listOrders(
    accountId: string,
    options: { state?: "all" | "open" | "executed"; days?: number } = {},
  ): Promise<SnapTradeOrderRecord[]> {
    return this.#request(
      "GET",
      `/accounts/${enc(accountId)}/orders`,
      z.array(SnapTradeOrderRecord),
      { query: { state: options.state, days: options.days } },
    );
  }

  /** One page of transactions in one account. Dates are YYYY-MM-DD. */
  listActivities(
    accountId: string,
    options: {
      startDate?: string;
      endDate?: string;
      /** Comma-separated SnapTrade types, e.g. "CONTRIBUTION,WITHDRAWAL". */
      type?: string;
      offset?: number;
      limit?: number;
    } = {},
  ): Promise<SnapTradePaginatedActivities> {
    return this.#request(
      "GET",
      `/accounts/${enc(accountId)}/activities`,
      SnapTradePaginatedActivities,
      { query: { ...options } },
    );
  }

  /**
   * Places an order with the brokerage in one call (`POST /trade/place`).
   * There is no impact step: SnapTrade forwards the order and the brokerage's
   * verdict comes back as the record's `status`. Pass `client_order_id` so a
   * retry cannot place the same order twice. Requires `trade`.
   */
  placeOrder(form: SnapTradeOrderForm): Promise<SnapTradeOrderRecord> {
    return this.#request("POST", "/trade/place", SnapTradeOrderRecord, { body: form });
  }

  async #request<T>(
    method: "GET" | "POST",
    path: string,
    schema: z.ZodType<T>,
    options: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${this.#baseUrl}${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#accessToken}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await this.#fetch(url, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 403 && path.startsWith("/trade")) {
      throw new TradingScopeMissing();
    }
    if (!response.ok) {
      throw new SnapTradeApiError(response.status, path, body);
    }
    return schema.parse(body);
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
