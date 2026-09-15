import { ACCOUNT_TYPES } from "@noadviceneeded/engine";
import {
  bigint,
  boolean,
  char,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { connections } from "./connections.js";

export const accountType = pgEnum("account_type", ACCOUNT_TYPES);

/**
 * `accountType` is inferred from the brokerage's type string on first sight
 * and thereafter owned by the user; `included` and the two ranks are the
 * user's choices. None of those four is overwritten by sync.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    connectionId: uuid()
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    snaptradeAccountId: text().notNull().unique(),
    name: text().notNull(),
    numberMasked: text().notNull(),
    rawType: text(),
    accountType: accountType().notNull().default("other"),
    /** Part of the buy and sell plans. */
    included: boolean().notNull().default(false),
    /** 1 is first. 0 means not yet ranked (assigned on the next sync). */
    contributionRank: integer().notNull().default(0),
    withdrawalRank: integer().notNull().default(0),
    currency: char({ length: 3 }).notNull().default("CAD"),
    /** Latest total from SnapTrade. */
    lastValueCents: bigint({ mode: "number" }),
    /** Settled cash in the target ETF's currency, from the balances endpoint. */
    cashCents: bigint({ mode: "number" }),
    cashAsOf: timestamp({ withTimezone: true }),
    /** SnapTrade's own account status: open, closed, archived, unavailable. */
    statusRaw: text(),
    isPaper: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_connection_id_idx").on(t.connectionId)],
);

export type Account = typeof accounts.$inferSelect;
