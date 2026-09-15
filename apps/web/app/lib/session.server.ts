import { and, eq, gt, isNull, lt, sessions, users, type User } from "@noadviceneeded/db";
import { createCookie, redirect } from "react-router";

import { getDb } from "./db.server.js";
import { getEnv, isConfigured, isProduction } from "./env.server.js";

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

export async function createUserSession(userId: string): Promise<string> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(sessions)
    .values({ userId, expiresAt })
    .returning({ id: sessions.id });
  if (!row) throw new Error("failed to create session");
  return sessionCookie().serialize(row.id);
}

/**
 * Cheap pre-check so signed-out requests, and deploys whose secrets are not
 * set yet, never touch the signing secret. The home page must render with no
 * configuration at all.
 */
async function sessionIdFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get("Cookie");
  if (!header || !header.includes(`${COOKIE_NAME}=`)) return null;
  if (!isConfigured()) return null;
  const value: unknown = await sessionCookie().parse(header);
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** The signed-in user, or null. Never throws on a bad cookie. */
export async function getOptionalUser(request: Request): Promise<User | null> {
  const sessionId = await sessionIdFromRequest(request);
  if (!sessionId) return null;
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
  return row.user;
}

/** Redirects to the home page when there is no session. */
export async function requireUser(request: Request): Promise<User> {
  const user = await getOptionalUser(request);
  if (!user) throw redirect("/");
  return user;
}

/** Deletes the session row and returns the header that clears the cookie. */
export async function destroySession(request: Request): Promise<string> {
  const sessionId = await sessionIdFromRequest(request);
  if (sessionId) {
    await getDb().delete(sessions).where(eq(sessions.id, sessionId));
  }
  return sessionCookie().serialize("", { maxAge: 0 });
}
