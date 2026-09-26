import { createYoga } from "graphql-yoga";

import { createContext, type GraphQLContext } from "./context.server.js";
import { schema } from "./schema.server.js";

export const GRAPHQL_PATH = "/api/graphql";

/**
 * The native app's API: one Pothos schema over the same server modules and
 * engine the web routes use. Errors thrown on purpose carry
 * `extensions.code`; anything unexpected is masked. No CORS: the only
 * clients are the native app and GraphiQL on this origin (outside
 * production).
 */
export const yoga = createYoga<Record<string, never>, GraphQLContext>({
  schema,
  graphqlEndpoint: GRAPHQL_PATH,
  context: ({ request }) => createContext(request),
  cors: false,
  graphiql: process.env.NODE_ENV !== "production",
  landingPage: false,
  maskedErrors: true,
});
