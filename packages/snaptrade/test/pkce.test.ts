import { describe, expect, it } from "vitest";

import {
  base64UrlEncode,
  codeChallengeS256,
  generateCodeVerifier,
  generateOpaqueToken,
} from "../src/index.js";

describe("PKCE", () => {
  it("derives the RFC 7636 appendix B challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    await expect(codeChallengeS256(verifier)).resolves.toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("produces verifiers inside the 43..128 window using the unreserved alphabet", () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v.length).toBeGreaterThanOrEqual(43);
      expect(v.length).toBeLessThanOrEqual(128);
      expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it("never repeats opaque tokens", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateOpaqueToken()));
    expect(seen.size).toBe(50);
  });

  it("base64url strips padding and uses the URL alphabet", () => {
    expect(base64UrlEncode(new Uint8Array([251, 255, 191]))).toBe("-_-_");
    expect(base64UrlEncode(new Uint8Array([1]))).toBe("AQ");
  });
});
