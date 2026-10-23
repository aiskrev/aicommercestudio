import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ layout */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({
  children,
  className,
  id,
  labelledBy,
  alt = false,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  alt?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx("py-16 sm:py-24", alt && "section-alt", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="t-eyebrow">
      <span className="h-px w-6 bg-gradient-to-r from-cyan-400 to-violet-400" aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = "left",
  as: Heading = "h2",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
}) {
  return (
    <div className={cx("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading id={id} className={cx(Heading === "h1" ? "t-h1" : "t-h2", eyebrow && "mt-4")}>
        {title}
      </Heading>
      {lead && <p className="t-lead mt-4">{lead}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ buttons */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerOutline";
export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  dangerOutline: "btn-danger-outline",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cx("btn", `btn-${size}`, variantClass[variant]);
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("spinner", className)} aria-hidden="true" />;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size), className)}
    >
      {loading && <Spinner />}
      {loading && loadingLabel ? loadingLabel : children}
      {!loading && icon && <Icon name={icon} className="h-4 w-4" />}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  icon,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), "group", className)}>
      {children}
      {icon && <Icon name={icon} className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
    </Link>
  );
}

/* ------------------------------------------------------------------ content blocks */

export function IconBadge({ name, className }: { name: IconName; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-violet-500/15 text-cyan-200 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)]",
        className,
      )}
    >
      <Icon name={name} className="h-5 w-5" />
    </span>
  );
}

export function FeatureCard({
  icon,
  title,
  description,
  headingLevel = 3,
  className,
}: {
  icon?: IconName;
  title: string;
  description: string;
  headingLevel?: 3 | 4;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <div className={cx("card p-6", className)}>
      {icon && <IconBadge name={icon} />}
      <Heading className={cx("t-h3", icon && "mt-5")}>{title}</Heading>
      <p className="mt-2 leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cx("grid gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
            <Icon name="check" className="h-3.5 w-3.5" />
          </span>
          <span className="leading-relaxed text-slate-300">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Badge({ children, accent = false, className }: { children: ReactNode; accent?: boolean; className?: string }) {
  return <span className={cx("badge", accent && "badge-accent", className)}>{children}</span>;
}

const alertIcon: Record<"error" | "success" | "warning" | "info", IconName> = {
  error: "alert",
  success: "check",
  warning: "alert",
  info: "info",
};

export function Alert({
  tone = "info",
  title,
  children,
  role,
  className,
}: {
  tone?: "error" | "success" | "warning" | "info";
  title?: string;
  children?: ReactNode;
  role?: "alert" | "status" | "note";
  className?: string;
}) {
  return (
    <div role={role} className={cx("alert", `alert-${tone}`, className)}>
      <Icon name={alertIcon[tone]} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "opacity-95")}>{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden="true" />;
}

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-white/5">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <Container className="relative py-14 sm:py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="t-h1 mt-5 max-w-4xl">{title}</h1>
        <p className="t-lead mt-6 max-w-3xl">{lead}</p>
        {children}
      </Container>
    </div>
  );
}
