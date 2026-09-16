import { bigint, char, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts.js";

/** Cash movements (CONTRIBUTION, WITHDRAWAL) SnapTrade reports, for room tracking. */
export const accountActivities = pgTable(
  "account_activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    snaptradeActivityId: text().notNull().unique(),
    type: text().notNull(),
    amountCents: bigint({ mode: "number" }).notNull(),
    currency: char({ length: 3 }).notNull().default("CAD"),
    tradeDate: date().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_activities_account_id_idx").on(t.accountId)],
);

export type AccountActivity = typeof accountActivities.$inferSelect;
