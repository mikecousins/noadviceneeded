import SchemaBuilder from "@pothos/core";
import {
  ACCOUNT_TYPES,
  COUNTRIES,
  ROOM_TYPES,
  type BuySkipReason,
  type Exchange,
  type MarketClosedReason,
  type SellSkipReason,
} from "@noadviceneeded/engine";
import { GraphQLError, Kind } from "graphql";

import type { GraphQLContext } from "./context.server.js";

/**
 * The Pothos builder. Fields are non-null unless they say otherwise, so the
 * Swift types the app generates carry no optionals the server never sends.
 */
export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  DefaultFieldNullability: false;
  Scalars: {
    Cents: { Input: number; Output: number };
    DateTime: { Input: Date; Output: Date | string };
    Date: { Input: string; Output: string };
  };
}>({ defaultFieldNullability: false });

function invalid(scalar: string): never {
  throw new GraphQLError(`Invalid ${scalar}.`, { extensions: { code: "BAD_USER_INPUT" } });
}

function parseCents(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : invalid("Cents");
}

builder.scalarType("Cents", {
  description:
    "Money as integer cents in the account's or fund's currency. Wider than Int: totals can pass 2^31.",
  serialize: (value) => parseCents(value),
  parseValue: parseCents,
  parseLiteral: (ast) => (ast.kind === Kind.INT ? parseCents(Number(ast.value)) : invalid("Cents")),
});

function parseDateTime(value: unknown): Date {
  if (typeof value !== "string") invalid("DateTime");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? invalid("DateTime") : date;
}

builder.scalarType("DateTime", {
  description: "An instant as an ISO 8601 string in UTC.",
  serialize: (value) => (value instanceof Date ? value : parseDateTime(value)).toISOString(),
  parseValue: parseDateTime,
  parseLiteral: (ast) =>
    ast.kind === Kind.STRING ? parseDateTime(ast.value) : invalid("DateTime"),
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: unknown): string {
  return typeof value === "string" && DAY.test(value) ? value : invalid("Date");
}

builder.scalarType("Date", {
  description: "A calendar day, YYYY-MM-DD.",
  serialize: parseDay,
  parseValue: parseDay,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? parseDay(ast.value) : invalid("Date")),
});

/** GraphQL enum values from the engine's lowercase ids: `roth_ira` is `ROTH_IRA`. */
function enumValues<T extends string>(values: readonly T[]) {
  return Object.fromEntries(values.map((v) => [v.toUpperCase(), { value: v }])) as {
    [K in T as Uppercase<K>]: { value: K };
  };
}

export const CountryEnum = builder.enumType("Country", { values: enumValues(COUNTRIES) });

export const AccountTypeEnum = builder.enumType("AccountType", {
  values: enumValues(ACCOUNT_TYPES),
});

export const RoomTypeEnum = builder.enumType("RoomType", {
  description: "A contribution limit. `IRA` is shared by a Roth and a Traditional IRA.",
  values: enumValues(ROOM_TYPES),
});

export const ConnectionStatusEnum = builder.enumType("ConnectionStatus", {
  values: enumValues(["active", "disabled", "removed"] as const),
});

export const RankOrderEnum = builder.enumType("RankOrder", {
  description: "Guideline one as two orders: where new cash goes, and where withdrawals come from.",
  values: enumValues(["contribution", "withdrawal"] as const),
});

export const DirectionEnum = builder.enumType("Direction", {
  values: enumValues(["up", "down"] as const),
});

export const SyncStatusEnum = builder.enumType("SyncStatus", {
  description:
    "SYNCED read SnapTrade now; FRESH skipped it inside the 15-minute cooldown; RECONNECT means sign in again; ERROR kept the last read.",
  values: enumValues(["synced", "fresh", "reconnect", "error"] as const),
});

export const PriceSourceEnum = builder.enumType("PriceSource", {
  values: enumValues(["manual", "quote", "holding"] as const),
});

export const ExchangeEnum = builder.enumType("Exchange", {
  values: enumValues<Exchange>(["tsx", "nyse"]),
});

export const MarketClosedReasonEnum = builder.enumType("MarketClosedReason", {
  values: enumValues<MarketClosedReason>(["weekend", "holiday", "before_open", "after_close"]),
});

export const BuySkipReasonEnum = builder.enumType("BuySkipReason", {
  values: enumValues<BuySkipReason>(["excluded", "not_tradable", "no_cash", "below_one_unit"]),
});

export const SellSkipReasonEnum = builder.enumType("SellSkipReason", {
  values: enumValues<SellSkipReason>(["excluded", "not_tradable", "no_position", "not_needed"]),
});

export const OrderBatchKindEnum = builder.enumType("OrderBatchKind", {
  values: enumValues(["invest", "withdraw"] as const),
});

export const OrderSideEnum = builder.enumType("OrderSide", {
  values: enumValues(["buy", "sell"] as const),
});
