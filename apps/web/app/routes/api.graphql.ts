import { yoga } from "~/graphql/yoga.server";

import type { Route } from "./+types/api.graphql";

/** GET (queries, and GraphiQL outside production) and POST /api/graphql. */
export function loader({ request }: Route.LoaderArgs) {
  return yoga.handleRequest(request, {});
}

export function action({ request }: Route.ActionArgs) {
  return yoga.handleRequest(request, {});
}
