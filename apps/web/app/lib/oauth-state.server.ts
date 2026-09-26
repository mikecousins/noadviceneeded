import {
  SIGN_IN_SCOPES,
  TRADING_SCOPES,
  buildAuthorizeUrl,
  codeChallengeS256,
  generateCodeVerifier,
  generateOpaqueToken,
} from "@noadviceneeded/snaptrade";
import { createCookie, redirect } from "react-router";
import { z } from "zod";

import { getEnv, isProduction } from "./env.server.js";

/**
 * Per-attempt OAuth state: the `state` and `nonce` we sent, the PKCE
 * verifier, and where to land afterwards. Lives in a signed, short-lived
 * cookie so the callback can verify the round-trip without a database row.
 */
const OAuthState = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(43),
  returnTo: z.string().startsWith("/").default("/app"),
  /**
   * Set when the native app started the sign-in: its own PKCE S256
   * challenge, echoed into the handoff code the callback sends back through
   * the app's URL scheme instead of setting a browser session.
   */
  mobileChallenge: z.string().min(43).max(128).optional(),
});
export type OAuthState = z.infer<typeof OAuthState>;

let cookie: ReturnType<typeof createCookie> | undefined;

function oauthCookie() {
  cookie ??= createCookie("nan_oauth", {
    secrets: [getEnv().SESSION_SECRET],
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/auth/snaptrade",
    maxAge: 10 * 60,
  });
  return cookie;
}

export function serializeOAuthState(state: OAuthState): Promise<string> {
  return oauthCookie().serialize(state);
}

export async function readOAuthState(request: Request): Promise<OAuthState | null> {
  const raw: unknown = await oauthCookie().parse(request.headers.get("Cookie"));
  const parsed = OAuthState.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function clearOAuthState(): Promise<string> {
  return oauthCookie().serialize("", { maxAge: 0 });
}

/** The redirect URI must match a registered one exactly, so it is built one way only. */
export function snaptradeRedirectUri(request: Request): string {
  const origin = getEnv().APP_ORIGIN ?? new URL(request.url).origin;
  return `${origin}/auth/snaptrade/callback`;
}

/** Where the native app listens for the end of a sign-in (its registered URL scheme). */
export const MOBILE_CALLBACK_URL = "noadviceneeded://auth/callback";

/**
 * Starts the SnapTrade authorize step: fresh state, nonce and PKCE verifier
 * in the signed cookie, then a redirect to SnapTrade. `trade` asks for the
 * trading scope on top of sign-in (the incremental consent step).
 */
export async function authorizeRedirect(
  request: Request,
  options: { trade: boolean; returnTo: string; mobileChallenge?: string },
): Promise<Response> {
  const state = generateOpaqueToken();
  const nonce = generateOpaqueToken();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await codeChallengeS256(codeVerifier);

  const url = buildAuthorizeUrl({
    clientId: getEnv().SNAPTRADE_OAUTH_CLIENT_ID,
    redirectUri: snaptradeRedirectUri(request),
    scopes: options.trade ? TRADING_SCOPES : SIGN_IN_SCOPES,
    state,
    nonce,
    codeChallenge,
  });

  const cookie = await serializeOAuthState({
    state,
    nonce,
    codeVerifier,
    returnTo: options.returnTo,
    ...(options.mobileChallenge ? { mobileChallenge: options.mobileChallenge } : {}),
  });
  return redirect(url.toString(), { headers: { "Set-Cookie": cookie } });
}
