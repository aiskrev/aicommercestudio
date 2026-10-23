import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({
  children,
  className,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx("py-16 sm:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
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
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cx("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-4 text-lg leading-relaxed text-slate-400">{lead}</p>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-cyan-400 to-blue-500 text-ink-950 shadow-[0_8px_30px_-8px_rgb(34_211_238_/_0.55)] hover:from-cyan-300 hover:to-blue-400",
  secondary: "border border-slate-500/30 bg-white/[0.04] text-white hover:border-cyan-400/50 hover:bg-white/[0.07]",
  ghost: "text-cyan-300 hover:text-cyan-200",
};

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "lg" = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
    size === "lg" ? "px-6 py-3.5 text-base" : "px-5 py-2.5 text-sm",
    buttonStyles[variant],
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
  size?: "md" | "lg";
  icon?: IconName;
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)}>
      {children}
      {icon && <Icon name={icon} className="h-4 w-4" />}
    </Link>
  );
}

export function IconBadge({ name, className }: { name: IconName; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-violet-500/15 text-cyan-200",
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
}: {
  icon?: IconName;
  title: string;
  description: string;
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <div className="glass rounded-2xl p-6">
      {icon && <IconBadge name={icon} />}
      <Heading className={cx("text-lg font-semibold", icon && "mt-5")}>{title}</Heading>
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
      <Container className="relative py-16 sm:py-24">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.1] sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-400 sm:text-xl">{lead}</p>
        {children}
      </Container>
    </div>
  );
}
