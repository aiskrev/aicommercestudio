import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ContactDetails } from "@/components/sections/ContactDetails";
import { FOUNDER_PORTRAIT, FounderPortrait } from "@/components/sections/Founder";
import { JsonLd } from "@/components/seo/JsonLd";
import { buttonClass, ButtonLink, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { company } from "@/lib/company";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata, founderJsonLd } from "@/lib/seo";

/** Topics from the approved profile (structured data only; not rendered as a skills list). */
const KNOWS_ABOUT = [
  "Enterprise AI architecture",
  "AI platform engineering",
  "Retrieval-augmented generation",
  "Cloud architecture",
  "Platform engineering",
  "DevOps",
  "Site reliability engineering",
  "Kubernetes",
  "Mission-critical infrastructure",
];

export async function generateMetadata({ params }: PageProps<"/[locale]/za-nas/osnovatel">) {
  const locale = await resolveLocale(params);
  const { founder } = getContent(locale);
  return buildMetadata({
    locale,
    title: founder.profile.metaTitle,
    description: founder.profile.metaDescription,
    path: routes.founder,
  });
}

export default async function FounderPage({ params }: PageProps<"/[locale]/za-nas/osnovatel">) {
  const locale = await resolveLocale(params);
  const { founder } = getContent(locale);
  const profile = founder.profile;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.founder);

  return (
    <>
      <JsonLd
        data={founderJsonLd(
          {
            name: founder.name,
            latinName: founder.latinName,
            jobTitle: profile.eyebrow,
            image: FOUNDER_PORTRAIT.src,
            path,
            knowsAbout: KNOWS_ABOUT,
          },
          locale,
        )}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.about, path: href(routes.about) },
          { name: founder.name, path },
        ]}
      />

      {/* executive introduction */}
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-10 pb-14 pt-10 sm:pb-16 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16 lg:pb-20">
          <div className="min-w-0">
            <Eyebrow>{profile.eyebrow}</Eyebrow>
            <h1 className="t-h1 mt-5">{profile.heading}</h1>
            <p className="mt-3 text-lg font-medium text-fg-secondary">{profile.subheading}</p>
            <p className="t-lead measure mt-6">{profile.intro}</p>
          </div>
          <FounderPortrait
            alt={founder.portraitAlt}
            priority
            sizes="(min-width: 1024px) 22rem, (min-width: 768px) 18rem, 16rem"
            className="order-first aspect-[4/5] w-56 md:order-none md:w-full"
          />
        </Container>
      </div>

      {/* profile */}
      <Section>
        <div className="grid gap-12">
          {profile.sections.map((section) => (
            <section key={section.title} className="grid gap-4 border-t border-line-subtle pt-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
              <h2 className="t-h3">{section.title}</h2>
              <p className="measure text-lg leading-relaxed text-fg-secondary">{section.text}</p>
            </section>
          ))}
        </div>
      </Section>

      {/* closing statement */}
      <Section tone="raised" labelledBy="founder-closing">
        <p id="founder-closing" className="grid gap-1 font-display text-[clamp(1.5rem,1.1rem+1.6vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {profile.closing.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={href(routes.services)} icon="arrowRight">
            {profile.primaryCta}
          </ButtonLink>
          <ButtonLink href={href(routes.contact)} variant="secondary">
            {profile.secondaryCta}
          </ButtonLink>
        </div>
      </Section>

      {/* executive contact */}
      <Section labelledBy="founder-contact-title">
        <div className="card grid gap-8 rounded-[var(--radius-lg)] p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <h2 id="founder-contact-title" className="t-h2 text-2xl sm:text-3xl">
              {founder.contactCta.heading}
            </h2>
            <p className="measure mt-4 leading-relaxed text-fg-muted">{founder.contactCta.text}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row" role="group" aria-label={founder.contactCta.heading}>
              <ButtonLink href={href(routes.contact)} icon="arrowRight">
                {founder.contactCta.primary}
              </ButtonLink>
              <a
                href={company.phoneUri}
                aria-label={dict.contactDetails.phoneAria.replace("{phone}", company.phoneDisplay)}
                className={buttonClass("secondary")}
              >
                {founder.contactCta.call.replace("{phone}", company.phoneDisplay)}
              </a>
            </div>
          </div>
          <ContactDetails labels={dict.contactDetails} />
        </div>
      </Section>
    </>
  );
}
