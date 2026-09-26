import { redirect } from "react-router";
import { z } from "zod";

import { MOBILE_CALLBACK_URL, authorizeRedirect } from "~/lib/oauth-state.server";

import type { Route } from "./+types/auth.snaptrade.mobile";

/** RFC 7636 S256 challenge: 43 base64url characters. */
const Challenge = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/**
 * GET /auth/snaptrade/mobile?code_challenge=…[&scope=trade]. The native app
 * opens this in an ASWebAuthenticationSession. It is the web sign-in with
 * one difference: the callback ends at `noadviceneeded://auth/callback` with
 * a short-lived code bound to the app's PKCE challenge, which the app trades
 * for a bearer token with the `exchangeSignInCode` GraphQL mutation. No
 * browser session is created, so a page that opens this URL gains nothing.
 */
export async function loader({ request, url }: Route.LoaderArgs) {
  const challenge = Challenge.safeParse(url.searchParams.get("code_challenge"));
  if (!challenge.success) {
    return redirect(`${MOBILE_CALLBACK_URL}?error=invalid_request`);
  }
  return authorizeRedirect(request, {
    trade: url.searchParams.get("scope") === "trade",
    returnTo: "/app",
    mobileChallenge: challenge.data,
  });
}
