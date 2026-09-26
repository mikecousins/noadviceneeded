import { codeChallengeS256, generateCodeVerifier } from "@noadviceneeded/snaptrade";
import { describe, expect, it } from "vitest";

import {
  HANDOFF_TTL_MS,
  readSessionToken,
  redeemHandoffCode,
  signHandoffCode,
  signSessionToken,
} from "./tokens.server.js";

const secret = "s".repeat(48);
const sessionId = "0b7f3c5e-8a61-4d2f-9c1e-5f4a3b2c1d0e";
const userId = "6a1d2c3b-4e5f-4a7b-8c9d-0e1f2a3b4c5d";

describe("session tokens", () => {
  it("round-trips a session id", () => {
    expect(readSessionToken(signSessionToken(sessionId, secret), secret)).toBe(sessionId);
  });

  it("rejects another secret, a tampered id, and junk", () => {
    const token = signSessionToken(sessionId, secret);
    expect(readSessionToken(token, "t".repeat(48))).toBeNull();
    expect(readSessionToken(token.replace("0b7f", "0b7e"), secret)).toBeNull();
    expect(readSessionToken(sessionId, secret)).toBeNull();
    expect(readSessionToken("not.a-token", secret)).toBeNull();
  });
});

describe("sign-in handoff codes", () => {
  const now = new Date("2026-09-26T15:00:00Z");

  it("redeems for the user with the matching verifier", async () => {
    const verifier = generateCodeVerifier();
    const code = signHandoffCode(
      { userId, challenge: await codeChallengeS256(verifier), now },
      secret,
    );
    expect(await redeemHandoffCode(code, verifier, secret, now)).toBe(userId);
  });

  it("refuses another verifier, an expired code, and a code minted as a session token", async () => {
    const verifier = generateCodeVerifier();
    const code = signHandoffCode(
      { userId, challenge: await codeChallengeS256(verifier), now },
      secret,
    );
    expect(await redeemHandoffCode(code, generateCodeVerifier(), secret, now)).toBeNull();
    const later = new Date(now.getTime() + HANDOFF_TTL_MS + 1);
    expect(await redeemHandoffCode(code, verifier, secret, later)).toBeNull();
    expect(
      await redeemHandoffCode(signSessionToken(sessionId, secret), verifier, secret, now),
    ).toBeNull();
  });
});
