import Link from "next/link";
import type { ReactNode } from "react";

import { KineticHeading } from "@/components/motion/KineticHeading";
import { MotionToggle } from "@/components/motion/MotionToggle";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ButtonLink, Eyebrow } from "@/components/ui/primitives";
import { AuroraBackground } from "@/components/velora/aurora-background";
import { GridPattern } from "@/components/velora/grid-pattern";
import { BarsLoader, DotsLoader, OrbitLoader, PulseLoader, SpinnerLoader } from "@/components/velora/loaders";
import { Marquee } from "@/components/velora/marquee";
import { OrbitingCircles } from "@/components/velora/orbiting-circles";
import { LiveDemo } from "@/components/velora-home/LiveDemo";
import type { VeloraHomeCopy } from "@/content/velora-home";

/** Velora `Tile` (upstream src/app/page.tsx L189–224): a bordered figure with the demo and a captioned link. */
function Tile({ title, href, note, className, children }: { title: string; href: string; note?: string; className?: string; children: ReactNode }) {
  return (
    <figure className={`vl-tile ${className ?? ""}`}>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      <figcaption>
        <Link href={href} className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-fg hover:text-brand">
          <span className="truncate">{title}</span>
          <Icon name="arrowRight" className="arrow-nudge size-3.5 shrink-0 text-muted-foreground" />
        </Link>
        {note && <span className="shrink-0 font-mono text-xs text-muted-foreground">{note}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * Homepage hero on the original Velora dark composition (docs/audits/velora-upstream-audit.md → source map): left the
 * eyebrow, the kinetic H1, the lead, two pill CTAs and a technical strip; right an asymmetric bento of live Velora
 * components (globe, morphing text, border beam, dock), then a second row (3D card, animated list, marquee, orbiting
 * circles, loaders) and the technology strip. The H1 and lead are server HTML (LCP); the demos load lazily.
 */
export function VeloraHero({
  eyebrow,
  title,
  highlight,
  lead,
  primary,
  secondary,
  extra,
  copy,
  links,
  tileHrefs,
  caption,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  lead: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  extra?: ReactNode;
  copy: VeloraHomeCopy;
  links: { label: string; href: string; icon: IconName }[];
  tileHrefs: Record<keyof VeloraHomeCopy["tiles"], string>;
  caption: string;
}) {
  const demo = (name: Parameters<typeof LiveDemo>[0]["name"]) => <LiveDemo name={name} copy={copy} links={links} />;
  return (
    <>
      <section className="vl-hero relative isolate overflow-hidden pb-16 pt-10 sm:pt-14 lg:pt-20" data-velora="" data-loop="" data-field="" aria-labelledby="hero-title">
        <AuroraBackground intensity="subtle" />
        <GridPattern width={48} height={48} className="fill-transparent stroke-line-subtle mask-[radial-gradient(ellipse_70%_50%_at_30%_0%,black,transparent)]" />
        <div className="relative mx-auto grid w-full max-w-wide grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
          <div className="min-w-0">
            <Eyebrow className="vl-pill fc-enter [--i:0]">{eyebrow}</Eyebrow>
            <KineticHeading id="hero-title" title={title} highlight={highlight} className="fc-rise vl-h1 mt-6 [--i:1]" />
            <p className="fc-rise t-lead mt-5 max-w-xl [--i:2]">{lead}</p>
            <div className="fc-rise mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center [--i:3]">
              <ButtonLink href={primary.href} size="lg" icon="arrowRight" testId="hero-primary" magnetic>
                {primary.label}
              </ButtonLink>
              <ButtonLink href={secondary.href} size="lg" variant="secondary" testId="hero-secondary">
                {secondary.label}
              </ButtonLink>
              {extra}
            </div>
            <p className="fc-enter mt-6 flex max-w-md items-center gap-2 rounded-xl border bg-card/60 py-2 pl-3.5 pr-3 font-mono text-xs text-muted-foreground backdrop-blur sm:text-sm [--i:4]">
              <span aria-hidden="true" className="text-brand">
                $
              </span>
              <span className="text-fg-secondary">{copy.stripLabel}:</span>
              <span className="min-w-0 truncate">{copy.strip.join(" → ")}</span>
            </p>
            <MotionToggle pauseLabel={copy.pauseLabel} playLabel={copy.playLabel} className="fc-enter mt-3 [--i:5]" />
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-3 lg:auto-rows-[10.5rem]" data-testid="hero-preview">
            <Tile title={copy.tiles.globe} href={tileHrefs.globe} note={copy.illustrative} className="vl-in col-span-2 h-80 sm:col-span-1 sm:row-span-2 lg:h-auto [--i:2]">
              {demo("globe")}
            </Tile>
            <Tile title={copy.tiles.morph} href={tileHrefs.morph} className="vl-in col-span-2 h-40 sm:col-span-1 lg:h-auto [--i:3]">
              {demo("morphing-text")}
            </Tile>
            <Tile title={copy.tiles.beam} href={tileHrefs.beam} className="vl-in col-span-2 h-40 sm:col-span-1 lg:h-auto [--i:4]">
              <div className="flex size-full items-center justify-center p-4">{demo("border-beam")}</div>
            </Tile>
            <Tile title={copy.tiles.dock} href={tileHrefs.dock} className="vl-in col-span-2 h-40 lg:h-auto [--i:5]">
              {demo("dock")}
            </Tile>
            {/* Inside the preview: every tile is a demonstration with sample content. */}
            <p className="col-span-2 font-mono text-xs text-muted-foreground">{caption}</p>
          </div>
        </div>

        <div className="relative mx-auto mt-3 grid w-full max-w-wide grid-cols-2 gap-3 px-4 sm:px-6 lg:auto-rows-[11rem] lg:grid-cols-4 lg:px-8">
          <Tile title={copy.tiles.card} href={tileHrefs.card} className="vl-in col-span-2 h-80 sm:col-span-1 lg:row-span-2 lg:h-auto [--i:6]">
            <div className="flex size-full items-center justify-center p-4">{demo("3d-card")}</div>
          </Tile>
          <Tile title={copy.tiles.list} href={tileHrefs.list} note={copy.illustrative} className="vl-in col-span-2 h-80 sm:col-span-1 lg:row-span-2 lg:h-auto [--i:7]">
            {demo("animated-list")}
          </Tile>
          <Tile title={copy.tiles.marquee} href={tileHrefs.marquee} className="vl-in col-span-2 h-44 lg:h-auto [--i:8]">
            <div className="flex size-full flex-col justify-center gap-2.5">
              {copy.marquee.map((row, index) => (
                <Marquee key={row[0]} pauseOnHover reverse={index === 1} repeat={2} className="[--duration:90s] [--gap:0.5rem]">
                  {row.map((label) => (
                    <span key={label} className="whitespace-nowrap rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                      {label}
                    </span>
                  ))}
                </Marquee>
              ))}
            </div>
          </Tile>
          <Tile title={copy.tiles.orbit} href={tileHrefs.orbit} className="vl-in h-48 lg:h-auto [--i:9]">
            <div className="relative flex size-full items-center justify-center" role="img" aria-label={copy.orbitLabel}>
              <Icon name="workflow" className="size-6 text-primary" />
              <OrbitingCircles radius={52} iconSize={26} duration={20}>
                <Icon name="globe" className="size-3.5 text-muted-foreground" />
                <Icon name="database" className="size-3.5 text-muted-foreground" />
                <Icon name="plug" className="size-3.5 text-muted-foreground" />
                <Icon name="chart" className="size-3.5 text-muted-foreground" />
              </OrbitingCircles>
            </div>
          </Tile>
          <Tile title={copy.tiles.loaders} href={tileHrefs.loaders} note={copy.illustrative} className="vl-in h-48 lg:h-auto [--i:10]">
            <div aria-hidden="true" className="flex size-full flex-wrap content-center items-center justify-center gap-4 p-4 text-primary">
              <DotsLoader />
              <PulseLoader />
              <OrbitLoader />
              <BarsLoader />
              <SpinnerLoader />
            </div>
          </Tile>
        </div>
      </section>

      {/* Technology strip (upstream "Built on the stack you already ship"): names only, no logos or partnership claims. */}
      <section aria-label={copy.stackLabel} className="border-y border-line-subtle py-12" data-velora="" data-loop="">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <p className="mb-8 text-center text-sm text-muted-foreground">{copy.stackLabel}</p>
          <Marquee pauseOnHover className="[--duration:30s]">
            {copy.stack.map((name) => (
              <span key={name} className="mx-8 text-lg font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground">
                {name}
              </span>
            ))}
          </Marquee>
        </div>
      </section>
    </>
  );
}
