import { redirect } from "react-router";

import { destroySession, getOptionalUser } from "~/lib/session.server";

import type { Route } from "./+types/auth.sign-out";

/**
 * POST /auth/sign-out. Ends this browser session. The SnapTrade grant stays
 * so signing back in is one click.
 */
export async function action({ request }: Route.ActionArgs) {
  await getOptionalUser(request);
  return redirect("/", { headers: { "Set-Cookie": await destroySession(request) } });
}

export function loader() {
  return redirect("/");
}
