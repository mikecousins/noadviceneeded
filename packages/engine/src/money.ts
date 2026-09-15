/** Dollars from an API (float) to integer cents. Null passes through. */
export function toCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
}

/** Integer cents to a dollar float for an API that wants dollars. */
export function toDollars(cents: number): number {
  return cents / 100;
}
