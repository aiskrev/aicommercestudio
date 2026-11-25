import { AuroraBackground } from "@/components/velora/aurora-background";
import { GridPattern } from "@/components/velora/grid-pattern";

/**
 * The Velora hero backdrop for inner pages (docs/audits/velora-upstream-audit.md → homepage source map): the aurora
 * from lg (phones: the grid only, lighter), a 48 px grid masked to the top left. Decorative; its loops pause off
 * screen (data-loop) and stop with reduced motion.
 */
export function VeloraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true" data-velora="" data-loop="">
      <AuroraBackground intensity="subtle" className="hidden lg:block" />
      <GridPattern width={48} height={48} className="fill-transparent stroke-line-subtle mask-[radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent)]" />
    </div>
  );
}
