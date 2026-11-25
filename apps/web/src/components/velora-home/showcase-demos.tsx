"use client";

// Adapted from Velora UI src/components/home/showcase-demos.tsx (MIT, see THIRD_PARTY_NOTICES.md): the same
// components with A.I. Commerce Studio copy and links. Loaded as one lazy chunk when a tile nears the viewport.
import { AnimatedList } from "@/components/velora/animated-list";
import { BorderBeam } from "@/components/velora/border-beam";
import { Card3D, Card3DItem } from "@/components/velora/3d-card";
import { Dock, DockIcon } from "@/components/velora/dock";
import { Globe, type GlobeArc, type GlobeMarker } from "@/components/velora/globe";
import { MorphingText } from "@/components/velora/morphing-text";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { VeloraHomeCopy } from "@/content/velora-home";

// Illustrative points only (not client, data-centre or traffic locations): Sofia, Frankfurt, London, New York.
const markers: GlobeMarker[] = [
  { lat: 42.7, lng: 23.32 },
  { lat: 50.11, lng: 8.68 },
  { lat: 51.51, lng: -0.13 },
  { lat: 40.71, lng: -74.01 },
];
const arcs: GlobeArc[] = [
  { from: [42.7, 23.32], to: [50.11, 8.68] },
  { from: [50.11, 8.68], to: [51.51, -0.13] },
  { from: [51.51, -0.13], to: [40.71, -74.01] },
];

export function GlobeDemo({ copy }: { copy: VeloraHomeCopy }) {
  return <Globe markers={markers} arcs={arcs} center={[42, 18]} label={copy.globeLabel} className="w-[min(100%,20rem)]" />;
}

export function MorphingTextDemo({ copy }: { copy: VeloraHomeCopy }) {
  // The words morph one after another; the line below lists them all at once, so nothing depends on the rotation.
  return (
    <div className="flex w-full flex-col items-center gap-2 px-4 text-center">
      <MorphingText texts={copy.morph} hold={2600} className="text-xl font-semibold tracking-tight sm:text-2xl" />
      <p className="text-xs text-muted-foreground">{copy.morph.join(" · ")}</p>
    </div>
  );
}

export function BorderBeamDemo({ copy }: { copy: VeloraHomeCopy }) {
  return (
    <div className="relative w-[min(100%,17rem)] overflow-hidden rounded-xl border bg-background p-4 shadow-sm">
      <BorderBeam size={70} duration={6} />
      <p className="text-sm font-medium text-foreground">{copy.beamTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{copy.beamText}</p>
    </div>
  );
}

export function DockDemo({ links }: { links: { label: string; href: string; icon: IconName }[] }) {
  return (
    <Dock>
      {links.map((link) => (
        <DockIcon key={link.href} label={link.label} href={link.href}>
          <Icon name={link.icon} className="size-5" />
        </DockIcon>
      ))}
    </Dock>
  );
}

export function Card3DDemo({ copy }: { copy: VeloraHomeCopy }) {
  return (
    <Card3D className="w-[min(100%,17rem)]" cardClassName="rounded-2xl border bg-background p-5 shadow-sm">
      <Card3DItem depth={40} className="text-lg font-semibold tracking-tight text-foreground">
        {copy.cardTitle}
      </Card3DItem>
      <Card3DItem depth={25} className="mt-1 text-xs text-muted-foreground">
        {copy.cardText}
      </Card3DItem>
      <Card3DItem depth={70} className="relative mt-4">
        <div className="relative grid gap-1.5 overflow-hidden rounded-xl bg-linear-to-br from-brand-from via-brand-via to-brand-to p-3 shadow-lg shadow-primary/25">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.12)_1px,transparent_1px)] bg-size-[18px_18px]" />
          {copy.cardLayers.map((layer, index) => (
            <Card3DItem key={layer} depth={20 + index * 18} className="relative rounded-md bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground">
              {layer}
            </Card3DItem>
          ))}
        </div>
      </Card3DItem>
    </Card3D>
  );
}

const LIST_ICONS: IconName[] = ["inbox", "check", "sparkles", "database", "pen"];

export function AnimatedListDemo({ copy }: { copy: VeloraHomeCopy }) {
  return (
    <div className="h-full w-full overflow-hidden px-4 pt-4 mask-[linear-gradient(to_bottom,black_70%,transparent)]">
      <AnimatedList delay={1600}>
        {copy.list.map((step, index) => (
          <div key={step.title} className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name={LIST_ICONS[index % LIST_ICONS.length]} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{step.title}</p>
              <p className="truncate text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        ))}
      </AnimatedList>
    </div>
  );
}
