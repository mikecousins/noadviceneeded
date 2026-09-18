import {
  bigint,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts.js";
import { users } from "./users.js";

export const orderBatchKind = pgEnum("order_batch_kind", ["invest", "withdraw"]);
export const orderSide = pgEnum("order_side", ["buy", "sell"]);

/** One click on Invest or Withdraw. */
export const orderBatches = pgTable("order_batches", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: orderBatchKind().notNull(),
  /** For withdrawals, what the user asked to take out. */
  requestedCents: bigint({ mode: "number" }),
  /** Price the plan was built on. */
  priceCents: bigint({ mode: "number" }).notNull(),
  ticker: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type OrderBatch = typeof orderBatches.$inferSelect;

/** One order per account per batch, with what SnapTrade and the brokerage said. */
export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    batchId: uuid()
      .notNull()
      .references(() => orderBatches.id, { onDelete: "cascade" }),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    side: orderSide().notNull(),
    universalSymbolId: text().notNull(),
    ticker: text().notNull(),
    /** Whole units sent, or for a dollar-sized order the units SnapTrade reported, else our estimate. */
    units: numeric({ precision: 20, scale: 6, mode: "number" }).notNull(),
    /** The dollar amount sent as `notional_value`; null when the order was sized in units. */
    notionalCents: bigint({ mode: "number" }),
    estimatedCents: bigint({ mode: "number" }).notNull(),
    brokerageOrderId: text(),
    /** SnapTrade order status (PENDING, EXECUTED, ...) or our own: planned, failed. */
    status: text().notNull().default("planned"),
    error: text(),
    placedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_batch_id_idx").on(t.batchId),
    index("orders_account_id_idx").on(t.accountId),
  ],
);

export type Order = typeof orders.$inferSelect;
