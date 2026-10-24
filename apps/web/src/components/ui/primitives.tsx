import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ layout */

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[76rem] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export type SectionTone = "default" | "raised" | "light";
export type SectionDensity = "compact" | "default" | "spacious";

const toneClass: Record<SectionTone, string> = {
  default: "",
  raised: "section-alt",
  light: "surface-light",
};

const densityClass: Record<SectionDensity, string> = {
  compact: "py-12 sm:py-16",
  default: "py-16 sm:py-24",
  spacious: "py-20 sm:py-28 lg:py-32",
};

/**
 * Page section. `tone` changes the surface (dark page, raised dark, light editorial) and
 * `density` the vertical rhythm, so consecutive sections do not all look the same.
 */
export function Section({
  children,
  className,
  id,
  labelledBy,
  alt = false,
  tone,
  density = "default",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  /** Legacy alias for `tone="raised"`. */
  alt?: boolean;
  tone?: SectionTone;
  density?: SectionDensity;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx(densityClass[density], toneClass[tone ?? (alt ? "raised" : "default")], className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("t-eyebrow", className)}>{children}</p>;
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
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand",
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
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-brand/12 text-brand">
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
    <div className="relative overflow-hidden border-b border-line-subtle">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <Container className="relative pb-14 pt-12 sm:pb-20 sm:pt-16">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="t-h1 mt-5 max-w-4xl">{title}</h1>
        <p className="t-lead mt-6 max-w-3xl">{lead}</p>
        {children}
      </Container>
    </div>
  );
}

/**
 * Editorial alternative to a card grid: items as rows separated by hairlines, in one or two
 * columns. Use for lists of capabilities, use cases or principles.
 */
export function FeatureIndex({
  items,
  columns = 2,
  className,
}: {
  items: { icon?: IconName; title: string; description: string }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <ul className={cx("grid gap-x-12", columns === 2 && "md:grid-cols-2", className)}>
      {items.map((item) => (
        <li key={item.title} className="flex gap-4 border-t border-line-subtle py-6">
          {item.icon && (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
          )}
          <div>
            <h3 className="t-h3">{item.title}</h3>
            <p className="mt-1.5 leading-relaxed text-fg-muted">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Hairline matrix for the light editorial surface (`<Section tone="light">`). */
export function FeatureMatrix({
  items,
  className,
}: {
  items: { icon?: IconName; title: string; description: string }[];
  className?: string;
}) {
  return (
    <ul
      className={cx(
        "grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-ink/15 bg-ink/15 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.title} className="bg-surface-light p-6 sm:p-7">
          {item.icon && (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-ink text-brand" aria-hidden="true">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
          )}
          <h3 className={cx("t-h3", item.icon && "mt-4")}>{item.title}</h3>
          <p className="mt-1.5 leading-relaxed text-ink-muted">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
