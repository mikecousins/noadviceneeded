import { accounts, connections, eq, users, type Db } from "@noadviceneeded/db";
import { classifyAccountType, includedByDefault, type Country } from "@noadviceneeded/engine";

import { effectiveCountry } from "./country.js";
import { assignMissingRanks } from "./sync.server.js";

/**
 * Records where the user invests. Confirming the country the app already
 * planned for changes nothing else. Switching to the other country starts
 * the account setup over, because nothing carries across: every account is
 * classified again from the brokerage's type string with the new country's
 * types, joins the plan by that type's default, and takes its place in the
 * new default orders; the fund is cleared so the ETF page offers the right
 * list. Room baselines stay, keyed by type, so they come back if the user
 * switches back.
 */
export async function setCountry(
  db: Db,
  user: { id: string; country: Country | null },
  country: Country,
  now = new Date(),
): Promise<{ changed: boolean }> {
  const changed = effectiveCountry(user) !== country;
  await db
    .update(users)
    .set({
      country,
      updatedAt: now,
      ...(changed
        ? { targetSymbolId: null, targetTicker: null, targetName: null, targetCurrency: "CAD" }
        : {}),
    })
    .where(eq(users.id, user.id));
  if (!changed) return { changed };

  const rows = await db
    .select({ id: accounts.id, name: accounts.name, rawType: accounts.rawType })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, user.id));
  for (const a of rows) {
    const accountType = classifyAccountType(a.rawType, a.name, country);
    await db
      .update(accounts)
      .set({
        accountType,
        included: includedByDefault(accountType),
        contributionRank: 0,
        withdrawalRank: 0,
        updatedAt: now,
      })
      .where(eq(accounts.id, a.id));
  }
  await assignMissingRanks(db, user.id, country, now);
  return { changed };
}
