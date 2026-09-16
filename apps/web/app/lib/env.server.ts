import { z } from "zod";

/**
 * Server-only configuration, validated once on first use rather than at
 * import so `react-router typegen` and the build never need real secrets.
 */
const Env = z.object({
  SNAPTRADE_OAUTH_CLIENT_ID: z.string().min(1),
  SNAPTRADE_OAUTH_CLIENT_SECRET: z.string().min(1),
  /** Signs the session and OAuth-state cookies. Any long random string. */
  SESSION_SECRET: z.string().min(32),
  /** 32 bytes, base64. Envelope key for brokerage tokens at rest. */
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .transform((s) => Buffer.from(s, "base64"))
    .refine((b) => b.length === 32, "TOKEN_ENCRYPTION_KEY must decode to 32 bytes"),
  /**
   * Public origin used to build the OAuth redirect URI. Optional: defaults to
   * the request origin, which is right for localhost and production.
   */
  APP_ORIGIN: z.url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof Env>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Server configuration is incomplete: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** True when every secret is present. Pages that work signed-out use this to avoid throwing. */
export function isConfigured(): boolean {
  if (cached) return true;
  return Env.safeParse(process.env).success;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
