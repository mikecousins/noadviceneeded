import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "react-router";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-accent text-accent hover:bg-accent-soft",
  ghost: "text-ink-muted hover:text-ink hover:bg-accent-soft",
  danger: "border border-danger text-danger hover:bg-danger-soft",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

type Tone = "info" | "success" | "warn" | "danger";

const tones: Record<Tone, string> = {
  info: "border-line bg-surface",
  success: "border-positive bg-positive-soft",
  warn: "border-warn bg-warn-soft",
  danger: "border-danger bg-danger-soft",
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
    <p role="status" className={`rounded-card border p-3 text-sm ${tones[tone]} ${className}`}>
      {children}
    </p>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-6 ${className}`}>
      {children}
    </section>
  );
}

export function PageTitle({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <div className="mt-8">
      <h1 className="text-xl">{title}</h1>
      {lede && <p className="mt-2 max-w-prose text-ink-muted">{lede}</p>}
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
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="money mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) {
  const color =
    tone === "success"
      ? "bg-positive-soft text-positive"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-accent-soft text-accent";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}
