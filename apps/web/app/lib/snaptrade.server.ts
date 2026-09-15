import { and, brokerageTokens, eq, type BrokerageToken } from "@noadviceneeded/db";
import {
  SnapTradeApiError,
  SnapTradeClient,
  refreshAccessToken,
  revokeRefreshToken,
  type TokenSet,
} from "@noadviceneeded/snaptrade";

import { getDb } from "./db.server.js";
import { getEnv } from "./env.server.js";
import { decryptSecret, encryptSecret } from "./secrets.server.js";

const PROVIDER = "snaptrade";
/** Refresh when this close to expiry so a request never races the 10-hour boundary. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export function oauthClient() {
  const env = getEnv();
  return {
    clientId: env.SNAPTRADE_OAUTH_CLIENT_ID,
    clientSecret: env.SNAPTRADE_OAUTH_CLIENT_SECRET,
  };
}

/** Store (or replace) the user's SnapTrade token pair, encrypted. */
export async function saveTokens(userId: string, tokens: TokenSet): Promise<void> {
  const values = {
    userId,
    provider: PROVIDER,
    accessTokenEnc: encryptSecret(tokens.accessToken),
    refreshTokenEnc: encryptSecret(tokens.refreshToken),
    scopes: tokens.scopes,
    expiresAt: tokens.expiresAt,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(brokerageTokens)
    .values(values)
    .onConflictDoUpdate({
      target: [brokerageTokens.userId, brokerageTokens.provider],
      set: values,
    });
}

/** Thrown when the user has no usable SnapTrade grant and must sign in again. */
export class SnapTradeReconnectRequired extends Error {
  override readonly name = "SnapTradeReconnectRequired";
}

async function loadTokenRow(userId: string): Promise<BrokerageToken | undefined> {
  const [row] = await getDb()
    .select()
    .from(brokerageTokens)
    .where(and(eq(brokerageTokens.userId, userId), eq(brokerageTokens.provider, PROVIDER)))
    .limit(1);
  return row;
}

/**
 * A client holding a live access token for this user, refreshing first if the
 * stored one is within five minutes of expiry. Refresh tokens rotate, so the
 * new pair is persisted before the client is returned.
 */
export async function getSnapTradeClient(userId: string): Promise<SnapTradeClient> {
  const row = await loadTokenRow(userId);
  if (!row) throw new SnapTradeReconnectRequired("No SnapTrade token on file.");

  if (row.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return new SnapTradeClient({ accessToken: decryptSecret(row.accessTokenEnc) });
  }

  let refreshed: TokenSet;
  try {
    refreshed = await refreshAccessToken(oauthClient(), decryptSecret(row.refreshTokenEnc));
  } catch (error) {
    if (error instanceof SnapTradeApiError && (error.status === 400 || error.status === 401)) {
      await getDb().delete(brokerageTokens).where(eq(brokerageTokens.id, row.id));
      throw new SnapTradeReconnectRequired("SnapTrade refresh token was rejected.");
    }
    throw error;
  }
  await saveTokens(userId, refreshed);
  return new SnapTradeClient({ accessToken: refreshed.accessToken });
}

/** Granted scopes on file, without touching SnapTrade. */
export async function getGrantedScopes(userId: string): Promise<string[]> {
  const row = await loadTokenRow(userId);
  return row?.scopes ?? [];
}

export async function hasTradeScope(userId: string): Promise<boolean> {
  return (await getGrantedScopes(userId)).includes("trade");
}

/** Revoke at SnapTrade (best effort) and forget the tokens. */
export async function forgetTokens(userId: string): Promise<void> {
  const row = await loadTokenRow(userId);
  if (!row) return;
  try {
    await revokeRefreshToken(oauthClient(), decryptSecret(row.refreshTokenEnc));
  } catch {
    // The row is deleted regardless; a stale grant at SnapTrade cannot be used without it.
  }
  await getDb().delete(brokerageTokens).where(eq(brokerageTokens.id, row.id));
}
