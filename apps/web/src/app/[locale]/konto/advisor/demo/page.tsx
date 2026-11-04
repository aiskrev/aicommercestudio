import { PageHero, Section } from "@/components/ui/primitives";
import { workspaceTexts } from "@/i18n/workspace";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Fixed sample rows, kept in the page on purpose: a demo never reads workspace data. */
const SAMPLE = {
  bg: [
    { label: "Базов вариант", text: "Измислен магазин обработва ръчно заявките за връщане на стоки." },
    { label: "С интеграция към склада", text: "Същият измислен магазин, след уточнение за складовата система." },
  ],
  en: [
    { label: "Base variant", text: "A made-up store handles return requests by hand." },
    { label: "With warehouse integration", text: "The same made-up store, after a clarification about its warehouse." },
  ],
};

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/advisor/demo">) {
  const locale = await resolveLocale(params);
  const t = workspaceTexts[locale];
  return buildMetadata({
    locale,
    title: t.demoTitle,
    description: t.demoLead,
    path: routes.accountAdvisorDemo,
    noindex: true,
  });
}

export default async function Page({ params }: PageProps<"/[locale]/konto/advisor/demo">) {
  const locale = await resolveLocale(params);
  const t = workspaceTexts[locale];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.demoTitle} lead={t.demoLead} />
      <Section>
        <ol className="max-w-2xl space-y-4">
          {SAMPLE[locale].map((row, index) => (
            <li key={row.label} className="text-sm">
              <strong>
                {t.version} {index + 1}: {row.label}
              </strong>
              <br />
              {t.templateResult}
              <br />
              {row.text}
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
