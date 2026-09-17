import type { AccountType } from "@noadviceneeded/engine";

/**
 * Account type is colour, not a word repeated on every row: the lime-to-olive
 * ramp runs in contribution order for either country, so FHSA or HSA is
 * always brightest and non-registered or taxable always dimmest, while
 * RESP, 529, workplace and other sit outside the ramp in grey. Class strings
 * are written out in full because Tailwind reads them literally.
 */
export const TYPE_TEXT: Record<AccountType, string> = {
  fhsa: "text-tier-1",
  tfsa: "text-tier-2",
  rrsp: "text-tier-3",
  non_registered: "text-tier-4",
  resp: "text-ink-muted",
  other: "text-ink-muted",
  hsa: "text-tier-1",
  roth_ira: "text-tier-2",
  ira: "text-tier-3",
  taxable: "text-tier-4",
  workplace: "text-ink-muted",
  plan_529: "text-ink-muted",
};

export const TYPE_FILL: Record<AccountType, string> = {
  fhsa: "bg-tier-1",
  tfsa: "bg-tier-2",
  rrsp: "bg-tier-3",
  non_registered: "bg-tier-4",
  resp: "bg-ink-dim",
  other: "bg-ink-dim",
  hsa: "bg-tier-1",
  roth_ira: "bg-tier-2",
  ira: "bg-tier-3",
  taxable: "bg-tier-4",
  workplace: "bg-ink-dim",
  plan_529: "bg-ink-dim",
};
