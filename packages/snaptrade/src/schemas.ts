import { z } from "zod";

/**
 * Only the fields the product reads. SnapTrade returns more; `.loose()` keeps
 * unknown keys from failing the parse so a new upstream field never breaks a
 * sync. Shapes follow the SnapTrade OpenAPI spec.
 */

export const SnapTradeCurrency = z
  .object({
    id: z.string().optional(),
    code: z.string(),
    name: z.string().nullable().optional(),
  })
  .loose();
export type SnapTradeCurrency = z.infer<typeof SnapTradeCurrency>;

export const SnapTradeBrokerage = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    display_name: z.string().optional(),
    allows_trading: z.boolean().nullable().optional(),
  })
  .loose();
export type SnapTradeBrokerage = z.infer<typeof SnapTradeBrokerage>;

/** A brokerage connection ("brokerage authorization" in the API). */
export const SnapTradeConnection = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    /** `read` or `trade`: whether the brokerage login itself allows trading via SnapTrade. */
    type: z.string().nullable().optional(),
    disabled: z.boolean().optional(),
    disabled_date: z.string().nullable().optional(),
    created_date: z.string().optional(),
    brokerage: SnapTradeBrokerage,
  })
  .loose();
export type SnapTradeConnection = z.infer<typeof SnapTradeConnection>;

export const SnapTradeAccountBalance = z
  .object({
    total: z
      .object({
        amount: z.number().nullable().optional(),
        currency: z.string().nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();

export const SnapTradeAccount = z
  .object({
    id: z.string(),
    brokerage_authorization: z.string(),
    name: z.string().nullable(),
    number: z.string(),
    institution_name: z.string(),
    /** Account type as the brokerage reports it, e.g. "TFSA", "RRSP", "FHSA", "Margin". */
    raw_type: z.string().nullable().optional(),
    account_category: z.enum(["INVESTMENT", "DEPOSIT", "LOC"]).nullable().optional(),
    status: z.enum(["open", "closed", "archived", "unavailable"]).nullable().optional(),
    balance: SnapTradeAccountBalance.nullable().optional(),
    created_date: z.string().optional(),
    is_paper: z.boolean().optional(),
  })
  .loose();
export type SnapTradeAccount = z.infer<typeof SnapTradeAccount>;

/** One per currency held as cash in the account. */
export const SnapTradeBalance = z
  .object({
    currency: SnapTradeCurrency.nullable().optional(),
    cash: z.number().nullable().optional(),
    buying_power: z.number().nullable().optional(),
  })
  .loose();
export type SnapTradeBalance = z.infer<typeof SnapTradeBalance>;

export const SnapTradeUniversalSymbol = z
  .object({
    id: z.string(),
    /** Ticker with exchange suffix in Yahoo style, e.g. "VEQT.TO". */
    symbol: z.string(),
    raw_symbol: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    currency: SnapTradeCurrency.nullable().optional(),
    exchange: z
      .object({
        code: z.string().nullable().optional(),
        mic_code: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        suffix: z.string().nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
    type: z.object({ code: z.string().nullable().optional() }).loose().nullable().optional(),
  })
  .loose();
export type SnapTradeUniversalSymbol = z.infer<typeof SnapTradeUniversalSymbol>;

export const SnapTradePosition = z
  .object({
    symbol: z
      .object({
        id: z.string().optional(),
        symbol: SnapTradeUniversalSymbol.nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
    units: z.number().nullable().optional(),
    price: z.number().nullable().optional(),
    average_purchase_price: z.number().nullable().optional(),
    currency: SnapTradeCurrency.nullable().optional(),
    cash_equivalent: z.boolean().nullable().optional(),
  })
  .loose();
export type SnapTradePosition = z.infer<typeof SnapTradePosition>;

export const SnapTradeQuote = z
  .object({
    symbol: SnapTradeUniversalSymbol,
    last_trade_price: z.number().nullable().optional(),
    bid_price: z.number().nullable().optional(),
    ask_price: z.number().nullable().optional(),
  })
  .loose();
export type SnapTradeQuote = z.infer<typeof SnapTradeQuote>;

export const SnapTradeActivity = z
  .object({
    id: z.string(),
    account: z.object({ id: z.string() }).loose().nullable().optional(),
    symbol: z
      .object({ id: z.string().optional(), symbol: z.string().optional() })
      .loose()
      .nullable()
      .optional(),
    /** CONTRIBUTION, WITHDRAWAL, BUY, SELL, DIVIDEND, ... SnapTrade's best-effort category. */
    type: z.string().nullable().optional(),
    amount: z.number().nullable().optional(),
    currency: SnapTradeCurrency.nullable().optional(),
    description: z.string().nullable().optional(),
    trade_date: z.string().nullable().optional(),
    settlement_date: z.string().nullable().optional(),
  })
  .loose();
export type SnapTradeActivity = z.infer<typeof SnapTradeActivity>;

export const SnapTradePaginatedActivities = z
  .object({
    data: z.array(SnapTradeActivity),
    pagination: z
      .object({
        offset: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();
export type SnapTradePaginatedActivities = z.infer<typeof SnapTradePaginatedActivities>;

/**
 * How an order is sized. SnapTrade takes exactly one of the two and wants the
 * other `null`: a share count, or a dollar amount the brokerage turns into
 * (fractional) shares at the fill. Dollar amounts only work with `Market` and
 * `Day`, which is all this product sends.
 */
export type SnapTradeOrderSize =
  { units: number; notional_value: null } | { units: null; notional_value: number };

/**
 * Body for `POST /trade/place`. Market, day: the only shape this product
 * sends. Whole `units` for most accounts; `notional_value` in dollars for
 * accounts the user marked fractional, because brokerages such as Wealthsimple
 * fill fractions by amount, not by decimal units. `client_order_id` is a UUID
 * SnapTrade uses to refuse a second copy of an order it already placed.
 */
export type SnapTradeOrderForm = {
  account_id: string;
  action: "BUY" | "SELL";
  universal_symbol_id: string;
  order_type: "Market" | "Limit";
  time_in_force: "Day" | "GTC";
  price?: number;
  client_order_id?: string;
} & SnapTradeOrderSize;

export const SnapTradeOrderRecord = z
  .object({
    brokerage_order_id: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    universal_symbol: SnapTradeUniversalSymbol.nullable().optional(),
    action: z.string().nullable().optional(),
    total_quantity: z.union([z.string(), z.number()]).nullable().optional(),
    filled_quantity: z.union([z.string(), z.number()]).nullable().optional(),
    execution_price: z.number().nullable().optional(),
    order_type: z.string().nullable().optional(),
    time_in_force: z.string().nullable().optional(),
    time_placed: z.string().nullable().optional(),
    time_executed: z.string().nullable().optional(),
  })
  .loose();
export type SnapTradeOrderRecord = z.infer<typeof SnapTradeOrderRecord>;
