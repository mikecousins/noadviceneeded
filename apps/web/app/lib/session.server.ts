import { and, eq, gt, isNull, lt, sessions, users, type User } from "@noadviceneeded/db";
import { createCookie, redirect } from "react-router";

import { getDb } from "./db.server.js";
import { getEnv, isConfigured, isProduction } from "./env.server.js";
import { readSessionToken, signSessionToken } from "./tokens.server.js";

const SESSION_DAYS = 30;
const COOKIE_NAME = "nan_session";
const TOUCH_AFTER_MS = 60 * 60 * 1000;

let cookie: ReturnType<typeof createCookie> | undefined;

/** Signed cookie carrying only the session row id. */
function sessionCookie() {
  cookie ??= createCookie(COOKIE_NAME, {
    secrets: [getEnv().SESSION_SECRET],
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return cookie;
}

async function insertSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await getDb()
    .insert(sessions)
    .values({ userId, expiresAt })
    .returning({ id: sessions.id, expiresAt: sessions.expiresAt });
  if (!row) throw new Error("failed to create session");
  return row;
}

export async function createUserSession(userId: string): Promise<string> {
  const row = await insertSession(userId);
  return sessionCookie().serialize(row.id);
}

/** A session for the native app, carried as `Authorization: Bearer <token>` instead of a cookie. */
export async function createBearerSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const row = await insertSession(userId);
  return { token: signSessionToken(row.id, getEnv().SESSION_SECRET), expiresAt: row.expiresAt };
}

/** How a request proved its session: the browser cookie or the native app's bearer token. */
export type SessionSource = "cookie" | "bearer";

/**
 * Cheap pre-check so signed-out requests, and deploys whose secrets are not
 * set yet, never touch the signing secret. The home page must render with no
 * configuration at all. A bearer token, when present, is the only credential
 * read: a bad one is signed out, never a fallback to the cookie.
 */
async function sessionFromRequest(
  request: Request,
): Promise<{ id: string; source: SessionSource } | null> {
  const authorization = request.headers.get("Authorization");
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!match?.[1] || !isConfigured()) return null;
    const id = readSessionToken(match[1], getEnv().SESSION_SECRET);
    return id ? { id, source: "bearer" } : null;
  }
  const id = await sessionIdFromCookie(request);
  return id ? { id, source: "cookie" } : null;
}

async function sessionIdFromCookie(request: Request): Promise<string | null> {
  const header = request.headers.get("Cookie");
  if (!header || !header.includes(`${COOKIE_NAME}=`)) return null;
  if (!isConfigured()) return null;
  const value: unknown = await sessionCookie().parse(header);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export interface UserSession {
  user: User;
  sessionId: string;
  source: SessionSource;
}

/** The signed-in user with the session that proved it, or null. Never throws on a bad credential. */
export async function getOptionalSession(request: Request): Promise<UserSession | null> {
  const session = await sessionFromRequest(request);
  if (!session) return null;
  const sessionId = session.id;
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now), isNull(users.deletedAt)))
    .limit(1);
  if (!row) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(sessions.id, sessionId),
          lt(sessions.lastSeenAt, new Date(now.getTime() - TOUCH_AFTER_MS)),
        ),
      );
  }
  return { user: row.user, sessionId, source: session.source };
}

/** The signed-in user, or null. Never throws on a bad cookie. */
export async function getOptionalUser(request: Request): Promise<User | null> {
  return (await getOptionalSession(request))?.user ?? null;
}

/** Redirects to the home page when there is no session. */
export async function requireUser(request: Request): Promise<User> {
  const user = await getOptionalUser(request);
  if (!user) throw redirect("/");
  return user;
}

/** Deletes the session row and returns the header that clears the cookie. */
export async function destroySession(request: Request): Promise<string> {
  const session = await sessionFromRequest(request);
  if (session) await revokeSession(session.id);
  return sessionCookie().serialize("", { maxAge: 0 });
}

/** Signs one session out, whichever way it was carried. */
export async function revokeSession(sessionId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.id, sessionId));
}
