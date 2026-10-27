import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { CheckList } from "@/components/ui/primitives";
import type { ArticleSection } from "@/content/types";

/**
 * Renders article sections: paragraphs, checklists, comparison tables and contextual internal
 * links. `insertAfter` places a node (e.g. a contextual CTA) after the given section index.
 */
export function ArticleBody({
  sections,
  localize,
  insertAfter,
  insert,
  relatedLabel,
}: {
  sections: ArticleSection[];
  localize: (path: string) => string;
  insertAfter?: number;
  insert?: ReactNode;
  relatedLabel: string;
}) {
  return (
    <div className="prose-content text-[17px] text-fg-secondary">
      {sections.map((section, index) => (
        <div key={section.heading}>
          <section className="mt-12 first:mt-0" aria-labelledby={`section-${index}`}>
            <h2 id={`section-${index}`} className="t-h2 text-2xl sm:text-[1.7rem]">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets && <CheckList items={section.bullets} className="mt-5" />}
            {section.table && (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-line-subtle">
                <table className="w-full min-w-[560px] text-left text-[15px]">
                  <caption className="px-4 pt-4 text-left text-sm font-semibold text-fg-secondary">
                    {section.table.caption}
                  </caption>
                  <thead className="border-b border-line-subtle text-xs uppercase tracking-wider text-fg-muted">
                    <tr>
                      {section.table.headers.map((header) => (
                        <th key={header} scope="col" className="px-4 py-3 font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {section.table.rows.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, cellIndex) =>
                          cellIndex === 0 ? (
                            <th key={cell} scope="row" className="px-4 py-3 font-medium text-fg">
                              {cell}
                            </th>
                          ) : (
                            <td key={`${row[0]}-${cellIndex}`} className="px-4 py-3 text-fg-secondary">
                              {cell}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.links && section.links.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-fg-muted">{relatedLabel}:</span>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={localize(link.href)}
                    className="inline-flex items-center gap-1 font-semibold text-brand no-underline hover:text-brand-soft"
                  >
                    {link.label}
                    <Icon name="arrowRight" className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </p>
            )}
          </section>
          {insertAfter === index && insert}
        </div>
      ))}
    </div>
  );
}
