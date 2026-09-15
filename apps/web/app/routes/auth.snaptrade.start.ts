import {
  SIGN_IN_SCOPES,
  TRADING_SCOPES,
  buildAuthorizeUrl,
  codeChallengeS256,
  generateCodeVerifier,
  generateOpaqueToken,
} from "@noadviceneeded/snaptrade";
import { redirect } from "react-router";

import { getEnv } from "~/lib/env.server";
import { serializeOAuthState, snaptradeRedirectUri } from "~/lib/oauth-state.server";

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
  const scopes = form.get("scope") === "trade" ? TRADING_SCOPES : SIGN_IN_SCOPES;

  const state = generateOpaqueToken();
  const nonce = generateOpaqueToken();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await codeChallengeS256(codeVerifier);

  const url = buildAuthorizeUrl({
    clientId: getEnv().SNAPTRADE_OAUTH_CLIENT_ID,
    redirectUri: snaptradeRedirectUri(request),
    scopes,
    state,
    nonce,
    codeChallenge,
  });

  return redirect(url.toString(), {
    headers: { "Set-Cookie": await serializeOAuthState({ state, nonce, codeVerifier, returnTo }) },
  });
}

export function loader() {
  return redirect("/");
}
