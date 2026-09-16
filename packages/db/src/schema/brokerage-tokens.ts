import { customType, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

/** Postgres bytea. Drizzle has no built-in; values travel as Buffers. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * One row per user per provider; only `snaptrade` today. Access and refresh
 * tokens are AES-GCM envelopes, never plaintext. Refresh tokens rotate on
 * every use, so the row is replaced atomically after each refresh.
 */
export const brokerageTokens = pgTable(
  "brokerage_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text().notNull().default("snaptrade"),
    accessTokenEnc: bytea().notNull(),
    refreshTokenEnc: bytea().notNull(),
    /** Scopes as granted on the token response: `read`, `trade`, etc. */
    scopes: text().array().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("brokerage_tokens_user_provider_unique").on(t.userId, t.provider)],
);

export type BrokerageToken = typeof brokerageTokens.$inferSelect;
