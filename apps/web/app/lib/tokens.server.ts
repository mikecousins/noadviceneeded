import { createHmac, timingSafeEqual } from "node:crypto";

import { codeChallengeS256 } from "@noadviceneeded/snaptrade";
import { z } from "zod";

/**
 * Stateless, HMAC-signed strings for the native app. Both are keyed by
 * `SESSION_SECRET`, like the cookies, with a purpose prefix so a token minted
 * for one use never verifies as the other.
 */

function mac(secret: string, purpose: string, payload: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${payload}`).digest("base64url");
}

function macMatches(secret: string, purpose: string, payload: string, given: string): boolean {
  const expected = Buffer.from(mac(secret, purpose, payload));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const SessionId = z.guid();

/**
 * The bearer token the native app sends as `Authorization: Bearer <token>`:
 * the session row id and its signature. Deleting the row revokes it, exactly
 * like the browser cookie.
 */
export function signSessionToken(sessionId: string, secret: string): string {
  return `${sessionId}.${mac(secret, "session", sessionId)}`;
}

/** The session id inside a well-signed token, or null. */
export function readSessionToken(token: string, secret: string): string | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const id = token.slice(0, dot);
  if (!SessionId.safeParse(id).success) return null;
  return macMatches(secret, "session", id, token.slice(dot + 1)) ? id : null;
}

/** How long the app has to redeem a sign-in handoff code. */
export const HANDOFF_TTL_MS = 2 * 60 * 1000;

const Handoff = z.object({
  /** User id. */
  u: z.guid(),
  /** The app's PKCE S256 challenge. */
  c: z.string().min(43),
  /** Expiry, epoch ms. */
  e: z.number().int(),
});

/**
 * The one-time code the SnapTrade callback hands to the native app through
 * its custom URL scheme. It names the user and carries the app's PKCE
 * challenge, so only the app that started the sign-in (and holds the
 * verifier) can turn it into a session, even if another app intercepts the
 * redirect.
 */
export function signHandoffCode(
  input: { userId: string; challenge: string; now?: Date },
  secret: string,
): string {
  const now = input.now ?? new Date();
  const payload = Buffer.from(
    JSON.stringify({ u: input.userId, c: input.challenge, e: now.getTime() + HANDOFF_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${mac(secret, "handoff", payload)}`;
}

/** The user id a handoff code was minted for, once its signature, expiry and verifier check out. */
export async function redeemHandoffCode(
  code: string,
  codeVerifier: string,
  secret: string,
  now = new Date(),
): Promise<string | null> {
  const dot = code.indexOf(".");
  if (dot === -1) return null;
  const payload = code.slice(0, dot);
  if (!macMatches(secret, "handoff", payload, code.slice(dot + 1))) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = Handoff.safeParse(decoded);
  if (!parsed.success || parsed.data.e <= now.getTime()) return null;
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return null;
  const challenge = await codeChallengeS256(codeVerifier);
  const expected = Buffer.from(parsed.data.c);
  const actual = Buffer.from(challenge);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return parsed.data.u;
}
