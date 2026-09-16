import { getDatabase } from "@netlify/database";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof createDb>;

/**
 * Drizzle over Netlify Database. Netlify injects the connection string per
 * deploy context at runtime as NETLIFY_DATABASE_URL; `netlify dev` and the
 * Netlify Vite plugin expose the local Postgres they start as NETLIFY_DB_URL.
 * Server-only: never import from client code.
 */
export function createDb() {
  const connectionString = process.env["NETLIFY_DATABASE_URL"] ?? process.env["NETLIFY_DB_URL"];
  const { pool } = getDatabase(connectionString ? { connectionString } : {});
  return drizzle({ client: pool as Pool, schema, casing: "snake_case" });
}
