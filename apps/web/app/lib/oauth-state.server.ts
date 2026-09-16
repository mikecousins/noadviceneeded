import { createCookie } from "react-router";
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
