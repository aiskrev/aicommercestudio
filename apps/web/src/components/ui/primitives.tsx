import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { KineticHeading } from "@/components/motion/KineticHeading";
import { reveal } from "@/components/motion/reveal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AuroraBackground } from "@/components/velora/aurora-background";
import { GridPattern } from "@/components/velora/grid-pattern";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ layout */

export type ContainerSize = "reading" | "narrow" | "content" | "wide";

const containerClass: Record<ContainerSize, string> = {
  reading: "max-w-reading",
  narrow: "max-w-narrow",
  content: "max-w-content",
  wide: "max-w-wide",
};

/**
 * Horizontal frame with the site gutters (16 / 24 / 32 px). `content` (76rem) is the default page
 * width; `reading` (44rem) suits long-form text, `narrow` (60rem) forms and focused flows.
 */
export function Container({
  children,
  className,
  size = "content",
}: {
  children: ReactNode;
  className?: string;
  size?: ContainerSize;
}) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6 lg:px-8", containerClass[size], className)}>{children}</div>;
}

export type SectionTone = "default" | "raised" | "deep" | "light";
export type SectionDensity = "compact" | "default" | "spacious";

const toneClass: Record<SectionTone, string> = {
  default: "",
  raised: "section-alt",
  deep: "surface-deep",
  light: "surface-light",
};

/** Fluid vertical rhythm (tokens --spacing-section*, 360 → 1440 px). */
const densityClass: Record<SectionDensity, string> = {
  compact: "py-section-compact",
  default: "py-section",
  spacious: "py-section-spacious",
};

/**
 * Page section. `tone` changes the surface (dark page, raised dark, near-black deep, warm paper)
 * and `density` the vertical rhythm, so consecutive sections do not all look the same.
 */
export function Section({
  children,
  className,
  id,
  labelledBy,
  alt = false,
  tone,
  density = "default",
  size,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  /** Legacy alias for `tone="raised"`. */
  alt?: boolean;
  tone?: SectionTone;
  density?: SectionDensity;
  size?: ContainerSize;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx(densityClass[density], toneClass[tone ?? (alt ? "raised" : "default")], className)}
    >
      {/* Velora section divider: a blue-cyan hairline that draws from the centre when the section is reached. */}
      <span className="vl-section-line" aria-hidden="true" {...reveal()} />
      <Container size={size}>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("t-eyebrow", className)}>{children}</p>;
}

/**
 * Section header: eyebrow, heading and lead. `action` (a link or button) sits to the right of the
 * text from `lg` and below it on smaller screens; `size="sm"` is for sub-sections.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = "left",
  as: Heading = "h2",
  size = "lg",
  action,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  size?: "lg" | "sm";
  action?: ReactNode;
  className?: string;
}) {
  const headingClass = Heading === "h1" ? "t-h1" : size === "sm" || Heading === "h3" ? "t-h3-lg" : "t-h2";
  // Section headings reveal once on scroll (components/motion/reveal.ts); a page's h1 never does.
  const text = (
    <div
      {...(Heading !== "h1" ? reveal() : {})}
      className={cx("max-w-3xl min-w-0", align === "center" && "mx-auto text-center", !action && className)}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {/* The words rise into place when the heading is scrolled to (KineticHeading, fc-kinetic-scroll). */}
      <KineticHeading as={Heading} id={id} title={title} className={cx(headingClass, Heading !== "h1" && "fc-kinetic-scroll", eyebrow && (size === "sm" ? "mt-3" : "mt-4"))} />
      {lead && <p className={cx("t-lead", size === "sm" ? "mt-3" : "mt-4")}>{lead}</p>}
    </div>
  );
  if (!action) return text;
  return (
    <div className={cx("grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end", className)}>
      {text}
      <div className="self-start lg:self-auto">{action}</div>
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
  if (loadingLabel) {
    // Both states share one grid cell (.btn-swap): the button keeps the width of the longer label, so it never
    // changes size while busy. The hidden state is `visibility: hidden` (inline, so it holds without the
    // stylesheet too): out of the accessible name and invisible, but still measured.
    const shown = { visibility: "visible" } as const;
    const kept = { visibility: "hidden" } as const;
    return (
      <button
        type="button"
        {...props}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cx(buttonClass(variant, size), className)}
      >
        <span className="btn-swap">
          <span style={loading ? kept : shown} aria-hidden={loading || undefined}>
            <span className="btn-label">{children}</span>
            {icon && <Icon name={icon} className="btn-icon h-4 w-4" />}
          </span>
          <span style={loading ? shown : kept} aria-hidden={!loading || undefined}>
            {loading && <Spinner />}
            <span className="btn-label">{loadingLabel}</span>
          </span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size), className)}
    >
      {loading && <Spinner />}
      <span className="btn-label">{children}</span>
      {!loading && icon && <Icon name={icon} className="btn-icon h-4 w-4" />}
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
  testId,
  magnetic = false,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  className?: string;
  testId?: string;
  /** Magnetic primary CTA (hero, final CTA): follows a fine pointer a few pixels (components/motion/pointer.ts). */
  magnetic?: boolean;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)} data-testid={testId} data-magnetic={magnetic ? "" : undefined}>
      <span className="btn-label">{children}</span>
      {icon && <Icon name={icon} className="btn-icon h-4 w-4" />}
    </Link>
  );
}

/* ------------------------------------------------------------------ content blocks */

export function IconBadge({ name, className }: { name: IconName; className?: string }) {
  return (
    <span
      className={cx(
        "icon-badge inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand",
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
      <p className="mt-2 leading-relaxed text-fg-muted">{description}</p>
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
          <span className="leading-relaxed text-fg-secondary">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "outline";

/** Short status or category label. `dot` adds a decorative status dot; the text carries the meaning. */
export function Badge({
  children,
  tone,
  accent = false,
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  /** Legacy alias for `tone="accent"`. */
  accent?: boolean;
  dot?: boolean;
  className?: string;
}) {
  const resolved = tone ?? (accent ? "accent" : "neutral");
  return (
    <span className={cx("badge", resolved !== "neutral" && `badge-${resolved}`, dot && "badge-dot", className)}>
      {children}
    </span>
  );
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

/**
 * Page hero (Future Commerce): the homepage's layered backdrop (drifting colour fields under a masked grid, CSS
 * only, still with reduced motion) and a light hairline on the bottom edge. `aside` places a visual (a product
 * preview, a key-facts panel) beside the text from `lg`; it eases in once and is never the LCP element.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="vl-page-hero relative isolate overflow-hidden border-b border-line-subtle" data-velora="" data-loop="">
      {/* Velora backdrop (docs/audits/velora-upstream-audit.md): aurora from lg (phones: the grid only), masked grid. */}
      <AuroraBackground intensity="subtle" className="hidden lg:block" />
      <GridPattern width={48} height={48} className="fill-transparent stroke-line-subtle mask-[radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent)]" />
      <Container className={cx("relative pb-14 pt-12 sm:pb-20 sm:pt-16", Boolean(aside) && "grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14")}>
        {/* Entrance (CSS only, once): eyebrow → heading → lead → actions → aside; the heading, the lead and the actions only rise (LCP). */}
        <div className="min-w-0">
          <Eyebrow className="vl-pill fc-enter [--i:0]">{eyebrow}</Eyebrow>
          <KineticHeading title={title} className="fc-rise t-h1 mt-5 max-w-4xl [--i:1]" />
          <p className="fc-rise t-lead mt-6 max-w-3xl [--i:2]">{lead}</p>
          {children && <div className="fc-rise [--i:3]">{children}</div>}
        </div>
        {aside && <div className="fc-enter min-w-0 [--i:4]">{aside}</div>}
      </Container>
      <span className="fc-horizon" aria-hidden="true" />
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

/** Hairline matrix for the light editorial surface (`<Section tone="raised">`). */
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
        "grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-line-subtle sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.title} className="bg-surface-1 p-6 sm:p-7">
          {item.icon && (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-brand" aria-hidden="true">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
          )}
          <h3 className={cx("t-h3", item.icon && "mt-4")}>{item.title}</h3>
          <p className="mt-1.5 leading-relaxed text-fg-muted">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
