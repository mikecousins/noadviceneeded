import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it, vi } from "vitest";

import type { SnapTradeApiError } from "../src/index.js";
import {
  SIGN_IN_SCOPES,
  SNAPTRADE_TOKEN_URL,
  SnapTradeOAuthError,
  TRADING_SCOPES,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  parseScopes,
  refreshAccessToken,
  verifyIdToken,
} from "../src/index.js";

const client = { clientId: "nan-client", clientSecret: "s3cret" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildAuthorizeUrl", () => {
  it("targets the dashboard authorize endpoint with S256 PKCE", () => {
    const url = buildAuthorizeUrl({
      clientId: "nan-client",
      redirectUri: "http://localhost:5173/auth/snaptrade/callback",
      scopes: SIGN_IN_SCOPES,
      state: "st",
      nonce: "nn",
      codeChallenge: "ch",
    });
    expect(url.origin + url.pathname).toBe("https://dashboard.snaptrade.com/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "nan-client",
      redirect_uri: "http://localhost:5173/auth/snaptrade/callback",
      scope: "openid email read",
      state: "st",
      nonce: "nn",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });

  it("asks for read and trade together when trading is enabled", () => {
    const url = buildAuthorizeUrl({
      clientId: "nan-client",
      redirectUri: "r",
      scopes: TRADING_SCOPES,
      state: "st",
      nonce: "nn",
      codeChallenge: "ch",
    });
    expect(url.searchParams.get("scope")).toBe("openid email read trade");
  });
});

describe("exchangeAuthorizationCode", () => {
  it("posts form-encoded body with HTTP Basic client auth and maps the response", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Basic ${btoa("nan-client:s3cret")}`);
      expect(headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
      expect(Object.fromEntries(new URLSearchParams(init?.body as string))).toEqual({
        grant_type: "authorization_code",
        code: "abc",
        code_verifier: "ver",
        redirect_uri: "http://localhost:5173/auth/snaptrade/callback",
      });
      return jsonResponse({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 36000,
        token_type: "Bearer",
        scope: "openid email read",
        id_token: "idt",
      });
    });
    const now = () => new Date("2026-09-15T00:00:00Z");
    const tokens = await exchangeAuthorizationCode(
      client,
      {
        code: "abc",
        codeVerifier: "ver",
        redirectUri: "http://localhost:5173/auth/snaptrade/callback",
      },
      { fetch: fetchMock as unknown as typeof fetch, now },
    );
    expect(fetchMock).toHaveBeenCalledWith(SNAPTRADE_TOKEN_URL, expect.anything());
    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date("2026-09-15T10:00:00Z"),
      scopes: ["openid", "email", "read"],
      idToken: "idt",
    });
  });

  it("surfaces token endpoint errors with status and body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "invalid_grant" }, 400));
    await expect(
      exchangeAuthorizationCode(
        client,
        { code: "x", codeVerifier: "v", redirectUri: "r" },
        { fetch: fetchMock as unknown as typeof fetch },
      ),
    ).rejects.toMatchObject<Partial<SnapTradeApiError>>({
      status: 400,
      body: { error: "invalid_grant" },
    });
  });
});

describe("refreshAccessToken", () => {
  it("uses the refresh_token grant and omits id_token", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(Object.fromEntries(new URLSearchParams(init?.body as string))).toEqual({
        grant_type: "refresh_token",
        refresh_token: "old-rt",
      });
      return jsonResponse({
        access_token: "at2",
        refresh_token: "new-rt",
        expires_in: 36000,
        token_type: "Bearer",
        scope: "read trade",
      });
    });
    const tokens = await refreshAccessToken(client, "old-rt", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(tokens.refreshToken).toBe("new-rt");
    expect(tokens.scopes).toEqual(["read", "trade"]);
    expect(tokens.idToken).toBeUndefined();
  });
});

describe("parseScopes", () => {
  it("splits on whitespace and drops empties", () => {
    expect(parseScopes(" openid  read trade ")).toEqual(["openid", "read", "trade"]);
  });
});

describe("verifyIdToken", () => {
  async function mint(overrides: Record<string, unknown> = {}, aud = "nan-client") {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const keySet = async () => publicKey;
    const jwt = await new SignJWT({
      email: "investor@example.ca",
      email_verified: true,
      nonce: "nn",
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid ?? "k1" })
      .setIssuer("https://api.snaptrade.com")
      .setAudience(aud)
      .setSubject("snaptrade-user-123")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(privateKey);
    return { jwt, keySet };
  }

  it("returns the subject and email for a valid token", async () => {
    const { jwt, keySet } = await mint();
    const identity = await verifyIdToken(
      { idToken: jwt, clientId: "nan-client", nonce: "nn" },
      keySet as never,
    );
    expect(identity).toEqual({
      subject: "snaptrade-user-123",
      email: "investor@example.ca",
      emailVerified: true,
    });
  });

  it("rejects a nonce mismatch", async () => {
    const { jwt, keySet } = await mint();
    await expect(
      verifyIdToken({ idToken: jwt, clientId: "nan-client", nonce: "other" }, keySet as never),
    ).rejects.toBeInstanceOf(SnapTradeOAuthError);
  });

  it("rejects a token issued for a different client", async () => {
    const { jwt, keySet } = await mint({}, "someone-else");
    await expect(
      verifyIdToken({ idToken: jwt, clientId: "nan-client", nonce: "nn" }, keySet as never),
    ).rejects.toMatchObject({ code: "invalid_id_token" });
  });
});
