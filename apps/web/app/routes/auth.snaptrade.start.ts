import { redirect } from "react-router";

import { authorizeRedirect } from "~/lib/oauth-state.server";

import type { Route } from "./+types/auth.snaptrade.start";

/**
 * POST /auth/snaptrade/start. Begins "Sign in with SnapTrade" with the read
 * scope, or, with `scope=trade`, the incremental-consent step that adds
 * trading. POST, not GET, so a third-party page cannot start the dance on the
 * user's behalf.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData().catch(() => new FormData());
  const returnToRaw = form.get("returnTo");
  const returnTo =
    typeof returnToRaw === "string" && returnToRaw.startsWith("/") && !returnToRaw.startsWith("//")
      ? returnToRaw
      : "/app";
  return authorizeRedirect(request, { trade: form.get("scope") === "trade", returnTo });
}

export function loader() {
  return redirect("/");
}
