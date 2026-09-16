import { bigint, date, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { accountType } from "./accounts.js";
import { users } from "./users.js";

/**
 * Contribution room per registered type, as the user entered it from CRA My
 * Account, valid at the end of `asOf`. Contributions synced after that day
 * reduce it (engine `remainingRoom`).
 */
export const contributionRoom = pgTable(
  "contribution_room",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountType: accountType().notNull(),
    roomCents: bigint({ mode: "number" }).notNull(),
    asOf: date().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contribution_room_user_type_unique").on(t.userId, t.accountType)],
);

export type ContributionRoom = typeof contributionRoom.$inferSelect;
