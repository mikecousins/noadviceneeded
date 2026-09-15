import { createDb, type Database } from "@noadviceneeded/db";

let db: Database | undefined;

/** One Drizzle client per serverless instance. */
export function getDb(): Database {
  db ??= createDb();
  return db;
}
