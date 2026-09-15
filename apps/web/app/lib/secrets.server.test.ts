import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decryptWithKey, encryptWithKey } from "./secrets.server.js";

describe("secrets envelope", () => {
  const key = randomBytes(32);

  it("round-trips and never repeats ciphertext", () => {
    const a = encryptWithKey(key, "refresh-token");
    const b = encryptWithKey(key, "refresh-token");
    expect(a.equals(b)).toBe(false);
    expect(decryptWithKey(key, a)).toBe("refresh-token");
    expect(decryptWithKey(key, b)).toBe("refresh-token");
  });

  it("rejects tampering and the wrong key", () => {
    const env = encryptWithKey(key, "secret");
    const tampered = Buffer.from(env);
    const last = tampered.length - 1;
    tampered[last] = (tampered[last] ?? 0) ^ 0xff;
    expect(() => decryptWithKey(key, tampered)).toThrow();
    expect(() => decryptWithKey(randomBytes(32), env)).toThrow();
  });

  it("refuses keys that are not 32 bytes", () => {
    expect(() => encryptWithKey(randomBytes(16), "x")).toThrow(/32 bytes/);
  });
});
