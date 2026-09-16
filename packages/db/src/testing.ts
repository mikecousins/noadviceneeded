import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "./schema/index.js";

/** Where drizzle-kit writes migrations and Netlify applies them from. */
export const MIGRATIONS_DIR = new URL(
  "../../../apps/web/netlify/database/migrations/",
  import.meta.url,
);

/**
 * An in-memory Postgres (PGlite) with every committed migration applied, in
 * the order Netlify applies them. Tests get the real schema and constraints.
 */
export async function createTestDb() {
  const client = new PGlite();
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const text = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
    for (const statement of text.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  const db = drizzle({ client, schema, casing: "snake_case" });
  return { db, client, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
