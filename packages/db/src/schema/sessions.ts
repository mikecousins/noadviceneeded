import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

/** The browser holds only the signed session id in a cookie. Deleting the row signs the user out. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export type Session = typeof sessions.$inferSelect;
