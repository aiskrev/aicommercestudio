import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { CheckList, Container } from "@/components/ui/primitives";
import type { LegalDocument } from "@/content/types";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { formatDate } from "@/lib/format";

export function LegalPage({
  document,
  draftNotice,
  breadcrumbs,
  updatedLabel,
}: {
  document: LegalDocument;
  draftNotice: string;
  breadcrumbs: { name: string; path: string }[];
  updatedLabel: string;
}) {
  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <Container className="max-w-3xl py-12 sm:py-16">
        <h1 className="text-3xl font-semibold sm:text-5xl">{document.title}</h1>
        <p className="mt-4 text-sm text-slate-400">
          {updatedLabel}:{" "}
          <time dateTime={document.updated}>
            {formatDate(document.updated, splitLocale(breadcrumbs[0]?.path ?? "")?.locale ?? defaultLocale)}
          </time>
        </p>
        <div
          role="note"
          className="mt-8 flex gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-5 text-sm leading-relaxed text-amber-100"
        >
          <Icon name="alert" className="h-5 w-5 shrink-0 text-amber-300" />
          <p>{draftNotice}</p>
        </div>
        <p className="mt-8 text-lg leading-relaxed text-slate-300">{document.intro}</p>
        <div className="prose-content text-slate-300">
          {document.sections.map((section) => (
            <section key={section.heading} className="mt-10">
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && <CheckList items={section.bullets} className="mt-4" />}
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
