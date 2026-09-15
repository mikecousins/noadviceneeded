import {
  bigint,
  char,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts.js";

/** Every stock/ETF position SnapTrade reports, refreshed whole on each sync. */
export const positions = pgTable(
  "positions",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    universalSymbolId: text().notNull(),
    ticker: text().notNull(),
    description: text(),
    units: numeric({ precision: 20, scale: 6, mode: "number" }).notNull(),
    /** Last price SnapTrade knew, in the position's currency. */
    priceCents: bigint({ mode: "number" }),
    currency: char({ length: 3 }).notNull().default("CAD"),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("positions_account_symbol_unique").on(t.accountId, t.universalSymbolId)],
);

export type Position = typeof positions.$inferSelect;
