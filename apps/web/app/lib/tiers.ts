import type { AccountType } from "@noadviceneeded/engine";

/**
 * Account type is colour, not a word repeated on every row: the lime-to-olive
 * ramp runs in contribution order, so FHSA is always brightest and
 * non-registered always dimmest, and RESP/other sit outside the ramp in grey.
 * Class strings are written out in full because Tailwind reads them literally.
 */
export const TYPE_TEXT: Record<AccountType, string> = {
  fhsa: "text-tier-1",
  tfsa: "text-tier-2",
  rrsp: "text-tier-3",
  non_registered: "text-tier-4",
  resp: "text-ink-muted",
  other: "text-ink-muted",
};

export const TYPE_FILL: Record<AccountType, string> = {
  fhsa: "bg-tier-1",
  tfsa: "bg-tier-2",
  rrsp: "bg-tier-3",
  non_registered: "bg-tier-4",
  resp: "bg-ink-dim",
  other: "bg-ink-dim",
};
