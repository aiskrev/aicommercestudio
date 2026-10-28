import { CheckList, SectionHeading } from "@/components/ui/primitives";
import type { readinessTool } from "@/content/bg/tool-readiness";
import { BAND_THRESHOLDS, DIMENSION_WEIGHTS, READINESS_DIMENSIONS } from "@/lib/readiness";

/**
 * Published scoring methodology and limitations of the AI readiness assessment. Rendered on the tool
 * page for everyone (no answers needed), from the same model constants the score is computed with.
 */
export function ReadinessMethodology({ content }: { content: typeof readinessTool }) {
  const m = content.result.methodology;
  const page = content.methodologyPage;
  const bands = [...BAND_THRESHOLDS].reverse().map((threshold, index, ordered) => ({
    ...threshold,
    max: index + 1 < ordered.length ? ordered[index + 1].min - 1 : 100,
  }));
  return (
    <div id="methodology" className="scroll-mt-24" data-testid="readiness-methodology">
      <SectionHeading id="readiness-methodology-title" title={page.title} lead={page.lead} />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-4 leading-relaxed text-fg-secondary">
          <p>{m.scale}</p>
          <p>{m.weights}</p>
          <table className="w-full text-left text-[15px]">
            <tbody>
              {READINESS_DIMENSIONS.map((dimension) => (
                <tr key={dimension} className="border-b border-line-subtle">
                  <th scope="row" className="py-2 pr-4 font-medium text-fg">
                    {content.steps[dimension].title}
                  </th>
                  <td className="py-2 text-right font-mono text-fg-secondary">{DIMENSION_WEIGHTS[dimension]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{m.blockers}</p>
        </div>
        <div className="grid content-start gap-6">
          <div>
            <h3 className="t-h3">{page.bandsTitle}</h3>
            <dl className="mt-4 grid gap-3">
              {bands.map(({ band, min, max }) => (
                <div key={band} className="rounded-[var(--radius-md)] border border-line-subtle p-4" data-band={band}>
                  <dt className="flex flex-wrap items-baseline justify-between gap-2 font-semibold text-fg">
                    {content.result.bands[band].title}
                    <span className="font-mono text-sm font-normal text-fg-muted">
                      {page.rangeLabel.replace("{min}", String(min)).replace("{max}", String(max))}
                    </span>
                  </dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{content.result.bands[band].description}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="t-h3">{m.limitationsTitle}</h3>
            <CheckList items={[...m.limitations]} className="mt-4" />
          </div>
          <p className="text-sm leading-relaxed text-fg-subtle">{m.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
