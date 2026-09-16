import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema/index.js";

export { createDb, type Database } from "./client.js";
export * from "./schema/index.js";
// Query helpers re-exported so app code never depends on drizzle-orm
// directly; one resolution of drizzle keeps the SQL types compatible.
export { and, asc, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";

/**
 * Any Drizzle Postgres client over this schema: the Neon/node-postgres one
 * from `createDb()` in the app, or a PGlite one in tests.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
