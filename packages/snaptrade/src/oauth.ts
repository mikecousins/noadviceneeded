import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { SnapTradeApiError, SnapTradeOAuthError } from "./errors.js";

/**
 * SnapTrade Personal OAuth endpoints. Values come from
 * https://api.snaptrade.com/.well-known/openid-configuration and are fixed,
 * so they are constants rather than discovered at runtime. `trade` and
 * `webhook` are partner-only scopes that SnapTrade deliberately omits from
 * `scopes_supported`; they are granted only to a partner-registered app,
 * always together with `read`.
 */
export const SNAPTRADE_ISSUER = "https://api.snaptrade.com";
export const SNAPTRADE_API_BASE = "https://api.snaptrade.com";
export const SNAPTRADE_AUTHORIZE_URL = "https://dashboard.snaptrade.com/oauth/authorize";
export const SNAPTRADE_TOKEN_URL = "https://api.snaptrade.com/oauth/token/";
export const SNAPTRADE_REVOKE_URL = "https://api.snaptrade.com/oauth/revoke_token/";
export const SNAPTRADE_INTROSPECT_URL = "https://api.snaptrade.com/oauth/introspect/";
export const SNAPTRADE_JWKS_URL = "https://api.snaptrade.com/.well-known/jwks.json";
/** Where users add, fix, or remove brokerage connections. No deep link beyond this. */
export const SNAPTRADE_DASHBOARD_URL = "https://dashboard.snaptrade.com";

export type SnapTradeScope = "openid" | "profile" | "email" | "read" | "trade" | "webhook";

/** Scope set requested at first sign-in. Read only, plus identity for the user record. */
export const SIGN_IN_SCOPES: readonly SnapTradeScope[] = ["openid", "email", "read"];

/** Scope set requested when the user enables trading (incremental consent). */
export const TRADING_SCOPES: readonly SnapTradeScope[] = ["openid", "email", "read", "trade"];

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface AuthorizeUrlParams {
  clientId: string;
  redirectUri: string;
  scopes: readonly SnapTradeScope[];
  state: string;
  nonce: string;
  codeChallenge: string;
}

export function buildAuthorizeUrl(params: AuthorizeUrlParams): URL {
  const url = new URL(SNAPTRADE_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
  scope: z.string(),
  id_token: z.string().optional(),
});

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry of the access token. */
  expiresAt: Date;
  scopes: SnapTradeScope[];
  /** Present on the authorization-code exchange when `openid` was requested. Never on refresh. */
  idToken?: string;
}

export function parseScopes(scope: string): SnapTradeScope[] {
  return scope.split(/\s+/).filter((s): s is SnapTradeScope => s.length > 0);
}

function basicAuth({ clientId, clientSecret }: OAuthClientConfig): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

async function postTokenEndpoint(
  client: OAuthClientConfig,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
  now: () => Date,
): Promise<TokenSet> {
  const response = await fetchImpl(SNAPTRADE_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(client),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new SnapTradeApiError(response.status, "/oauth/token/", json);
  }
  const parsed = TokenResponse.safeParse(json);
  if (!parsed.success) {
    throw new SnapTradeOAuthError("token_endpoint", "Token endpoint returned an unexpected body.");
  }
  const t = parsed.data;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: new Date(now().getTime() + t.expires_in * 1000),
    scopes: parseScopes(t.scope),
    ...(t.id_token ? { idToken: t.id_token } : {}),
  };
}

export interface ExchangeCodeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthDeps {
  fetch?: typeof fetch;
  now?: () => Date;
}

export async function exchangeAuthorizationCode(
  client: OAuthClientConfig,
  params: ExchangeCodeParams,
  deps: OAuthDeps = {},
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
  });
  return postTokenEndpoint(client, body, deps.fetch ?? fetch, deps.now ?? (() => new Date()));
}

/**
 * Refresh tokens rotate: the returned refresh token replaces the stored one
 * and the old one stops working. Callers must persist the new pair before
 * using it.
 */
export async function refreshAccessToken(
  client: OAuthClientConfig,
  refreshToken: string,
  deps: OAuthDeps = {},
): Promise<TokenSet> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  return postTokenEndpoint(client, body, deps.fetch ?? fetch, deps.now ?? (() => new Date()));
}

/** Revoking the refresh token ends the grant. */
export async function revokeRefreshToken(
  client: OAuthClientConfig,
  refreshToken: string,
  deps: OAuthDeps = {},
): Promise<void> {
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(SNAPTRADE_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(client),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token" }),
  });
  if (!response.ok) {
    const json: unknown = await response.json().catch(() => undefined);
    throw new SnapTradeApiError(response.status, "/oauth/revoke_token/", json);
  }
}

export interface SnapTradeIdentity {
  /** SnapTrade Personal user id. Stable; becomes `users.snaptrade_subject`. */
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}

const IdTokenClaims = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  nonce: z.string().optional(),
});

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function remoteJwks() {
  jwks ??= createRemoteJWKSet(new URL(SNAPTRADE_JWKS_URL));
  return jwks;
}

export interface VerifyIdTokenParams {
  idToken: string;
  clientId: string;
  /** The nonce sent on the authorize request; must round-trip. */
  nonce: string;
}

/**
 * Verifies the RS256 signature against SnapTrade's JWKS, plus `iss`, `aud`,
 * `exp`, and `nonce`. Returns the identity we key the user record on.
 */
export async function verifyIdToken(
  params: VerifyIdTokenParams,
  keySet: Parameters<typeof jwtVerify>[1] = remoteJwks(),
): Promise<SnapTradeIdentity> {
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(params.idToken, keySet, {
      issuer: SNAPTRADE_ISSUER,
      audience: params.clientId,
      algorithms: ["RS256"],
    }));
  } catch (error) {
    throw new SnapTradeOAuthError(
      "invalid_id_token",
      `id_token failed verification: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const claims = IdTokenClaims.safeParse(payload);
  if (!claims.success) {
    throw new SnapTradeOAuthError("invalid_id_token", "id_token is missing required claims.");
  }
  if (claims.data.nonce !== params.nonce) {
    throw new SnapTradeOAuthError("invalid_id_token", "id_token nonce does not match.");
  }
  const { sub, email, email_verified, name } = claims.data;
  return {
    subject: sub,
    ...(email ? { email } : {}),
    ...(email_verified !== undefined ? { emailVerified: email_verified } : {}),
    ...(name ? { name } : {}),
  };
}
