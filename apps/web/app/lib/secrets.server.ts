import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getEnv } from "./env.server.js";

/**
 * AES-256-GCM envelope for secrets at rest. Layout:
 *
 *   byte 0      version (0x01)
 *   bytes 1-12  IV, 96-bit, random per call
 *   bytes 13-28 GCM auth tag
 *   bytes 29-   ciphertext
 *
 * The version byte lets a future key rotation decrypt old rows. The key is
 * passed explicitly so this is testable without environment; the `*Secret`
 * wrappers read it from TOKEN_ENCRYPTION_KEY.
 */
const VERSION = 0x01;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encryptWithKey(key: Buffer, plaintext: string): Buffer {
  if (key.length !== 32) throw new Error("encryption key must be 32 bytes");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
}

export function decryptWithKey(key: Buffer, envelope: Buffer): string {
  if (key.length !== 32) throw new Error("encryption key must be 32 bytes");
  if (envelope.length < 1 + IV_BYTES + TAG_BYTES) throw new Error("envelope too short");
  if (envelope[0] !== VERSION) throw new Error(`unknown envelope version ${envelope[0]}`);
  const iv = envelope.subarray(1, 1 + IV_BYTES);
  const tag = envelope.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ciphertext = envelope.subarray(1 + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptSecret(plaintext: string): Buffer {
  return encryptWithKey(getEnv().TOKEN_ENCRYPTION_KEY, plaintext);
}

export function decryptSecret(envelope: Buffer): string {
  return decryptWithKey(getEnv().TOKEN_ENCRYPTION_KEY, envelope);
}
