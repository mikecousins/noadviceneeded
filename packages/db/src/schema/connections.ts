import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const connectionStatus = pgEnum("connection_status", ["active", "disabled", "removed"]);

/**
 * A brokerage authorization as SnapTrade reports it. `removed` means
 * SnapTrade stopped returning it; the row and its accounts stay so order
 * history keeps its context.
 */
export const connections = pgTable("connections", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  snaptradeAuthorizationId: text().notNull().unique(),
  brokerageSlug: text().notNull(),
  brokerageName: text().notNull(),
  status: connectionStatus().notNull().default("active"),
  /** The brokerage login allows trading via SnapTrade and the token carries `trade`. */
  canTrade: boolean().notNull().default(false),
  lastSyncedAt: timestamp({ withTimezone: true }),
  lastSyncError: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Connection = typeof connections.$inferSelect;
