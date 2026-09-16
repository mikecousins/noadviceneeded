import { defineConfig } from "drizzle-kit";

// drizzle-kit generates into the directory Netlify's built-in runner applies
// from on every deploy: apps/web/netlify/database/migrations. The runner picks
// up every `<number>_<slug>.sql` in order and ignores drizzle-kit's `meta/`
// folder. `db:generate` needs no connection; `db:migrate` and `db:studio`
// read the database URL Netlify injects (NETLIFY_DATABASE_URL) or the local
// one (NETLIFY_DB_URL).
const url = process.env["NETLIFY_DATABASE_URL"] ?? process.env["NETLIFY_DB_URL"];

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "../../apps/web/netlify/database/migrations",
  casing: "snake_case",
  ...(url ? { dbCredentials: { url } } : {}),
});
