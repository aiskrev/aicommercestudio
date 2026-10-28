import type { ReportBlock, ReportDocument } from "@/lib/assessment-api";
import { Alert, cx } from "@/components/ui/primitives";

/**
 * Accessible HTML rendering of a server report document — the same content as the PDF. Every value
 * is plain text rendered by React (escaped); nothing is interpreted as markup.
 */
export function ReportView({ document: doc, label }: { document: ReportDocument; label: string }) {
  return (
    <article aria-label={label} lang={doc.locale} className="tool-frame grid gap-8 p-6 sm:p-8" data-testid="engine-report-view">
      <header className="grid gap-2 border-b border-line-subtle pb-6">
        <p className="t-label">{doc.brand}</p>
        <h2 className="t-h2">{doc.title}</h2>
        <p className="text-fg-muted">{doc.subtitle}</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {doc.meta.map((item) => (
            <div key={item.label} className="flex gap-2">
              <dt className="text-fg-muted">{item.label}:</dt>
              <dd className="font-medium text-fg">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>
      {doc.sections.map((section, index) => (
        <section key={`${section.heading}-${index}`} aria-labelledby={`report-section-${index}`} className="grid gap-4">
          <h3 id={`report-section-${index}`} className="t-h3-lg">
            {section.heading}
          </h3>
          {section.blocks.map((block, blockIndex) => (
            <Block key={blockIndex} block={block} />
          ))}
        </section>
      ))}
      <footer className="border-t border-line-subtle pt-4 text-sm text-fg-muted">{doc.footer}</footer>
    </article>
  );
}

function Block({ block }: { block: ReportBlock }) {
  if (block.type === "paragraph") {
    if (block.tone === "notice") {
      return (
        <Alert tone="warning" role="note">
          {block.text}
        </Alert>
      );
    }
    return <p className={cx("max-w-3xl leading-relaxed", block.tone === "muted" ? "text-fg-muted" : "text-fg-secondary")}>{block.text}</p>;
  }
  if (block.type === "bullets") {
    return (
      <ul className="grid list-disc gap-1.5 pl-5 text-fg-secondary">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "table") {
    const hasHeaders = block.headers.some(Boolean);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
          {hasHeaders && (
            <thead>
              <tr>
                {block.headers.map((header, i) => (
                  <th key={i} scope="col" className="border-b border-line-default py-2 pr-4 font-semibold text-fg">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row" className="border-b border-line-subtle py-2 pr-4 align-top font-medium text-fg">
                      {cell}
                    </th>
                  ) : (
                    <td key={c} className="border-b border-line-subtle py-2 pr-4 align-top text-fg-secondary">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "scores") {
    return (
      <ul className="grid gap-3">
        {block.rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-fg">{row.label}</span>
              <span className="font-mono text-fg-secondary">
                {row.score}/100 · {row.level}
              </span>
            </div>
            <meter min={0} max={100} low={40} high={70} optimum={100} value={row.score} aria-label={`${row.label}: ${row.score}/100`} className="tool-meter mt-1.5 block h-2 w-full" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-4">
      {block.items.map((item) => (
        <li key={item.title} className="rounded-[var(--radius-md)] border border-line-subtle p-4">
          <p className="font-semibold text-fg">
            {item.title}
            {item.label && <span className="ml-2 text-sm font-normal text-fg-muted">· {item.label}</span>}
          </p>
          <p className="mt-1 leading-relaxed text-fg-secondary">{item.description}</p>
          {item.because.length > 0 && (
            <p className="mt-2 text-sm text-fg-muted">
              {block.because_label}: {item.because.join("; ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
