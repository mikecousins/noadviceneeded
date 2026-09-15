import { char, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row per person. Keyed on the SnapTrade OIDC subject. The target ETF
 * lives here because the product has exactly one per user.
 */
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  displayName: text(),
  /** `sub` of the verified SnapTrade id_token. */
  snaptradeSubject: text().unique("users_snaptrade_subject_unique"),
  /** SnapTrade universal symbol id of the chosen all-in-one ETF. */
  targetSymbolId: text(),
  /** Yahoo-style ticker, e.g. VEQT.TO. */
  targetTicker: text(),
  targetName: text(),
  targetCurrency: char({ length: 3 }).notNull().default("CAD"),
  /** Last time SnapTrade was read for this user; drives the refresh cooldown. */
  lastSyncedAt: timestamp({ withTimezone: true }),
  deletedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
