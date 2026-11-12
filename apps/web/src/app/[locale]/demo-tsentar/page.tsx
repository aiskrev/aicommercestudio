import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink, PageHero, Section } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import type { DemoKind } from "@/content/bg/offer-pages";
import type { ServiceKey } from "@/content/types";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { demoTexts } from "@/i18n/demos";
import { DEMO_KEYS, DEMO_SLUGS } from "@/lib/demo-slugs";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd } from "@/lib/seo";
import { isToolAvailable, type ToolKey, TOOLS, toolHrefs } from "@/lib/tools";

const DEMO_LINKS: Record<string, string> = {
  workflow: `${routes.home}#orchestration-title`,
  scenarios: routes.scenarios,
  agents: routes.agentLibrary,
};

/** The agent library is listed as a demo: it is a planning catalogue, not a working tool. */
const NOT_A_FREE_TOOL: ToolKey[] = ["agents"];

const TEAM_SERVICES: ServiceKey[] = ["audit", "ai_managed", "business_websites", "store_development", "portals_web_apps", "security_performance"];

function Chip({ kind, label }: { kind: DemoKind; label: string }) {
  return (
    <span className="badge" data-testid={`demo-kind-${kind}`}>
      {label}
    </span>
  );
}

export async function generateMetadata({ params }: PageProps<"/[locale]/demo-tsentar">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).demoCentre;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.demoCentre });
}

/** Every entry carries one label, so an example can never be read as a working product. */
export default async function DemoCentrePage({ params }: PageProps<"/[locale]/demo-tsentar">) {
  const locale = await resolveLocale(params);
  const { demoCentre: t, tools } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const links = toolHrefs(locale);
  const freeTools = TOOLS.filter((tool) => isToolAvailable(tool) && !NOT_A_FREE_TOOL.includes(tool.key) && links[tool.key]);
  const order: DemoKind[] = ["demo", "tool", "service", "future"];

  return (
    <>
      <JsonLd data={collectionPageJsonLd({ name: t.title, description: t.metaDescription, path: href(routes.demoCentre) }, locale)} />
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.demoCentre) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <Section labelledBy="demo-legend-title">
        <h2 id="demo-legend-title" className="t-h3">
          {t.legendTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {order.map((kind) => (
            <li key={kind} className="card p-5">
              <a href={`#${kind}`} className="font-medium text-fg hover:text-brand">
                {t.kinds[kind].label}
              </a>
              <p className="mt-2 text-body-sm text-fg-muted">{t.kinds[kind].text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section size="wide" labelledBy="interactive-title">
        <section id="interactive" aria-labelledby="interactive-title" className="scroll-mt-28" data-testid="demo-section-interactive">
          <h2 id="interactive-title" className="t-h2">
            {demoTexts[locale].listTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-fg-muted">{demoTexts[locale].listLead}</p>
          <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {DEMO_KEYS.map((key) => (
              <li key={key} className="card flex flex-col p-6">
                <span className="badge badge-warning">{demoTexts[locale].badge}</span>
                <h3 className="t-h3 mt-4">{demoTexts[locale].scenarios[key].title}</h3>
                <p className="mt-2 flex-1 text-body-sm text-fg-muted">{demoTexts[locale].scenarios[key].lead}</p>
                <ButtonLink href={href(routes.demoScenario(DEMO_SLUGS[key].bg))} variant="secondary" icon="arrowRight" className="mt-5">
                  {demoTexts[locale].open}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      </Section>

      <Section size="wide">
        <div className="grid gap-14">
          {order.map((kind) => (
            <section key={kind} id={kind} aria-labelledby={`${kind}-title`} className="scroll-mt-28" data-testid={`demo-section-${kind}`}>
              <h2 id={`${kind}-title`} className="t-h2">
                {t.sections[kind].title}
              </h2>
              <p className="mt-2 max-w-3xl text-fg-muted">{t.sections[kind].lead}</p>
              <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {kind === "demo" &&
                  t.demos.map((item) => (
                    <li key={item.key} className="card flex flex-col p-6">
                      <Chip kind={kind} label={t.kinds[kind].label} />
                      <h3 className="t-h3 mt-4">{item.title}</h3>
                      <p className="mt-2 flex-1 text-body-sm text-fg-muted">{item.text}</p>
                      <ButtonLink href={href(DEMO_LINKS[item.key])} variant="secondary" icon="arrowRight" className="mt-5">
                        {item.cta}
                      </ButtonLink>
                    </li>
                  ))}
                {kind === "tool" &&
                  freeTools.map((tool) => {
                    const text = tools.items.find((item) => item.key === tool.key)!;
                    return (
                      <li key={tool.key} className="card flex flex-col p-6">
                        <Chip kind={kind} label={t.kinds[kind].label} />
                        <h3 className="t-h3 mt-4">{text.title}</h3>
                        <p className="mt-2 flex-1 text-body-sm text-fg-muted">{text.description}</p>
                        <ButtonLink href={links[tool.key]!} icon="arrowRight" className="mt-5">
                          {t.toolCta}
                        </ButtonLink>
                      </li>
                    );
                  })}
                {kind === "service" &&
                  TEAM_SERVICES.map((key) => {
                    const service = serviceByKey(locale, key);
                    return (
                      <li key={key} className="card flex flex-col p-6">
                        <Chip kind={kind} label={t.kinds[kind].label} />
                        <h3 className="t-h3 mt-4">{service.shortTitle}</h3>
                        <p className="mt-2 flex-1 text-body-sm text-fg-muted">{service.summary}</p>
                        <ButtonLink href={href(routes.service(service.slug))} variant="secondary" icon="arrowRight" className="mt-5">
                          {t.serviceCta}
                        </ButtonLink>
                      </li>
                    );
                  })}
                {kind === "future" &&
                  t.future.map((item) => (
                    <li key={item.key} className="card flex flex-col p-6">
                      <Chip kind={kind} label={t.kinds[kind].label} />
                      <h3 className="t-h3 mt-4">{item.title}</h3>
                      <p className="mt-2 text-body-sm text-fg-muted">{item.text}</p>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </Section>
      <CtaBand
        title={t.ctaTitle}
        lead={t.ctaLead}
        primary={{ href: href(routes.contact), label: t.ctaPrimary }}
        secondary={{ href: href(routes.services), label: t.ctaSecondary }}
      />
    </>
  );
}
