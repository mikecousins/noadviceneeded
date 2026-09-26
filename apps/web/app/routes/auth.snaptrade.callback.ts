import { users } from "@noadviceneeded/db";
import {
  SnapTradeOAuthError,
  exchangeAuthorizationCode,
  verifyIdToken,
} from "@noadviceneeded/snaptrade";
import { redirect } from "react-router";

import { getDb } from "~/lib/db.server";
import { getEnv } from "~/lib/env.server";
import {
  MOBILE_CALLBACK_URL,
  clearOAuthState,
  readOAuthState,
  snaptradeRedirectUri,
  type OAuthState,
} from "~/lib/oauth-state.server";
import { createUserSession, getOptionalUser } from "~/lib/session.server";
import { oauthClient, saveTokens } from "~/lib/snaptrade.server";
import { signHandoffCode } from "~/lib/tokens.server";

import type { Route } from "./+types/auth.snaptrade.callback";

/** Redirect home, or back to the native app, with a short reason the screen can explain. */
async function failure(reason: string, stored?: OAuthState) {
  const to = stored?.mobileChallenge
    ? `${MOBILE_CALLBACK_URL}?error=${encodeURIComponent(reason)}`
    : `/?signin=${encodeURIComponent(reason)}`;
  return redirect(to, { headers: { "Set-Cookie": await clearOAuthState() } });
}

/**
 * GET /auth/snaptrade/callback. Completes the code exchange server-side,
 * verifies the id_token, and keys the user record on its `sub`. Serves both
 * first sign-in and the later "enable trading" consent, which returns the
 * same way with a wider scope.
 */
export async function loader({ request, url }: Route.LoaderArgs) {
  const stored = await readOAuthState(request);
  if (!stored) {
    // The state cookie is cleared once a sign-in completes. A second hit on
    // the callback (a duplicated request, back button) arrives without it; if
    // that browser already holds a session, the sign-in worked.
    if (await getOptionalUser(request)) return redirect("/app");
    return failure("expired");
  }

  const denied = url.searchParams.get("error");
  if (denied) return failure(denied === "access_denied" ? "declined" : "failed", stored);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== stored.state) return failure("mismatch", stored);

  const client = oauthClient();

  let tokens;
  let identity;
  try {
    tokens = await exchangeAuthorizationCode(client, {
      code,
      codeVerifier: stored.codeVerifier,
      redirectUri: snaptradeRedirectUri(request),
    });
    if (!tokens.idToken) throw new SnapTradeOAuthError("invalid_id_token", "No id_token returned.");
    identity = await verifyIdToken({
      idToken: tokens.idToken,
      clientId: client.clientId,
      nonce: stored.nonce,
    });
  } catch (error) {
    console.error("snaptrade callback failed", error instanceof Error ? error.message : error);
    return failure("failed", stored);
  }
  if (!identity.email) return failure("email", stored);

  let userId: string;
  try {
    const db = getDb();
    const now = new Date();
    const [user] = await db
      .insert(users)
      .values({
        email: identity.email,
        displayName: identity.name ?? null,
        snaptradeSubject: identity.subject,
      })
      .onConflictDoUpdate({
        target: users.snaptradeSubject,
        set: { email: identity.email, updatedAt: now, deletedAt: null },
      })
      .returning({ id: users.id });
    if (!user) throw new Error("user upsert returned no row");

    await saveTokens(user.id, tokens);
    userId = user.id;
  } catch (error) {
    console.error(
      "snaptrade callback could not persist the sign-in",
      error instanceof Error ? error.message : error,
    );
    return failure("failed", stored);
  }

  // The native app gets a code bound to its PKCE challenge, never a browser session.
  if (stored.mobileChallenge) {
    const code = signHandoffCode(
      { userId, challenge: stored.mobileChallenge },
      getEnv().SESSION_SECRET,
    );
    return redirect(`${MOBILE_CALLBACK_URL}?code=${encodeURIComponent(code)}`, {
      headers: { "Set-Cookie": await clearOAuthState() },
    });
  }

  const headers = new Headers();
  headers.append("Set-Cookie", await createUserSession(userId));
  headers.append("Set-Cookie", await clearOAuthState());
  return redirect(stored.returnTo, { headers });
}
