import { Tooltip } from "@base-ui/react/tooltip";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@noadviceneeded/engine";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "react-router";

import { TYPE_TEXT } from "~/lib/tiers";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-canvas hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:border-accent hover:text-accent",
  ghost: "text-ink-muted hover:bg-raised hover:text-ink",
  // Sells get their own colour so a withdrawal never looks like a deposit.
  danger: "bg-sell text-canvas hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-[10px]",
  md: "px-5 py-3 text-[11px]",
  lg: "w-full px-6 py-5 text-[13px]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-mono font-bold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40";

/* The brand mark: an acid tile carrying the N, the same geometry as the
 * favicon in public/ so the tab and the header never drift apart. */
export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="16" className="fill-accent" />
      <path d="M16 47V17h8l16 18V17h8v30h-8L24 29v18z" className="fill-canvas" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
  );
}

/* A disabled link renders as a greyed span so it neither navigates nor takes
 * focus, whatever variant it would otherwise have been. */
const disabledLink = "cursor-not-allowed border border-line bg-raised text-ink-dim";

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${base} ${sizes[size]} ${disabledLink} ${className}`}>
        {props.children}
      </span>
    );
  }
  return <Link className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

type Tone = "info" | "success" | "warn" | "danger";

const tones: Record<Tone, string> = {
  info: "border-line bg-surface text-ink",
  success: "border-accent bg-accent-soft text-ink",
  warn: "border-warn bg-warn-soft text-ink",
  danger: "border-danger bg-danger-soft text-ink",
};

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role="status" className={`rounded-tile border p-4 text-sm ${tones[tone]} ${className}`}>
      {children}
    </p>
  );
}

const cardTones = {
  plain: "border-line",
  accent: "border-accent",
  sell: "border-sell",
} as const;

export function Card({
  children,
  className = "",
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof cardTones;
}) {
  return (
    <section className={`rounded-card border-2 bg-surface p-6 ${cardTones[tone]} ${className}`}>
      {children}
    </section>
  );
}

/** A quieter block inside a Card: rows, chips, nested lists. */
export function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-tile bg-raised p-4 ${className}`}>{children}</div>;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`label ${className}`}>{children}</span>;
}

export function PageTitle({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <h1 className="text-3xl sm:text-mega">{title}</h1>
      {lede && <p className="max-w-sm text-sm text-ink-muted">{lede}</p>}
    </div>
  );
}

/** The one big number a page is about. */
export function Hero({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <p className="figure mt-3 text-hero">{value}</p>
      {sub && <p className="mt-4 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <Label>{label}</Label>
      <p className="figure mt-3 text-figure">{value}</p>
      {hint && <p className="mt-3 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) {
  const color =
    tone === "success"
      ? "bg-accent-soft text-accent"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-raised text-ink-muted";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.12em] uppercase ${color}`}
    >
      {children}
    </span>
  );
}

/** Account type as a colour chip: the ramp carries the meaning, not more prose. */
export function TypeTag({ type, className = "" }: { type: AccountType; className?: string }) {
  return (
    <span
      className={`inline-block rounded-lg bg-raised px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase ${TYPE_TEXT[type]} ${className}`}
    >
      {ACCOUNT_TYPE_LABELS[type]}
    </span>
  );
}

/**
 * The account's own name (the user can rename it in the SnapTrade dashboard),
 * with the masked number one hover or focus away for telling twins apart.
 */
export function AccountName({
  name,
  numberMasked,
  className = "",
}: {
  name: string;
  numberMasked: string;
  className?: string;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span tabIndex={0} />}
        className={`cursor-default underline decoration-line decoration-dotted underline-offset-4 outline-none focus-visible:decoration-accent ${className}`}
      >
        {name}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6}>
          <Tooltip.Popup className="rounded-lg border border-line bg-raised px-2.5 py-1.5 font-mono text-[10px] tracking-[0.12em] text-ink">
            {numberMasked}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Shares one hover delay across every tooltip below it; wrap a page or the layout once. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delay={300}>{children}</Tooltip.Provider>;
}

/** A filled bar. `percent` is clamped, so an over-contribution still draws. */
export function Meter({
  percent,
  fill = "bg-accent",
  className = "",
}: {
  percent: number;
  fill?: string;
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-2 rounded-full ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Proportions of a whole, one bar: net worth by account, equity vs bonds. */
export function Ribbon({
  segments,
  className = "",
}: {
  segments: { key: string; weight: number; fill: string }[];
  className?: string;
}) {
  const total = segments.reduce((n, s) => n + s.weight, 0);
  if (total <= 0) return null;
  return (
    <div className={`flex h-4 gap-1 ${className}`}>
      {segments
        .filter((s) => s.weight > 0)
        .map((s) => (
          <div
            key={s.key}
            className={`rounded-sm ${s.fill}`}
            style={{ flexGrow: s.weight, flexBasis: 0 }}
          />
        ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border-2 border-dashed border-line p-10 text-center">
      <h2 className="text-xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
