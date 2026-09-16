/**
 * PKCE (RFC 7636) and random-state helpers over Web Crypto, which Node 22+
 * exposes as `globalThis.crypto`. SnapTrade requires S256 (discovery
 * `code_challenge_methods_supported: ["S256"]`).
 */

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 random bytes, base64url: 43 chars, inside RFC 7636's 43..128 window. */
export function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Opaque high-entropy value for OAuth `state` and OIDC `nonce`. */
export function generateOpaqueToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}
