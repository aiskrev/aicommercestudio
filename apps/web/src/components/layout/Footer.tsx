import Link from "next/link";
import type { ReactNode } from "react";

import { AccountLinks } from "@/components/layout/AccountEntry";
import { Logo } from "@/components/layout/Logo";
import { ContactDetails } from "@/components/sections/ContactDetails";
import { ButtonLink, Container } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { AI_SERVICE_NAV, FOUNDATION_SERVICE_NAV } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const href = (path: string) => localizePath(locale, path);
  const serviceLinks = (keys: ServiceKey[]) =>
    keys.map((key) => {
      const service = serviceByKey(locale, key);
      return { href: href(routes.service(service.slug)), label: service.shortTitle };
    });
  const { workshops, reference, demoCentre, carePlans } = getContent(locale);
  const resources = [
    { href: href(routes.aiSolutions), label: dict.nav.aiSolutions },
    { href: href(routes.tools), label: dict.nav.tools },
    { href: href(routes.demoCentre), label: demoCentre.eyebrow },
    { href: href(routes.carePlans), label: carePlans.title },
    { href: href(routes.workshops), label: workshops.page.title },
    { href: href(routes.scenarios), label: reference.scenarios.title },
    { href: href(routes.patterns), label: reference.patterns.title },
    { href: href(routes.insights), label: dict.nav.insights },
  ];
  const company = [
    { href: href(routes.about), label: dict.nav.about },
    { href: href(routes.process), label: dict.nav.approach },
    { href: href(routes.industries), label: dict.nav.industries },
    { href: href(routes.contact), label: dict.nav.contact },
  ];
  const legal = [
    { href: href(routes.privacy), label: dict.footer.privacy },
    { href: href(routes.cookies), label: dict.footer.cookies },
    { href: href(routes.terms), label: dict.footer.terms },
    { href: href(routes.subscriptionTerms), label: dict.footer.subscriptionTerms },
  ];

  return (
    <footer className="relative mt-auto border-t border-line-subtle bg-ink-950">
      {/* statement + primary action */}
      <Container className="grid gap-8 border-b border-line-subtle py-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:py-16">
        <div>
          <Logo href={href(routes.home)} />
          <p className="t-h3-lg mt-6 max-w-2xl text-fg">
            {dict.footer.tagline}
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:items-end">
          <ButtonLink href={href(routes.contact)} variant="secondary" icon="arrowRight">
            {dict.nav.cta}
          </ButtonLink>
          <ContactDetails labels={dict.contactDetails} align="end" />
        </div>
      </Container>

      {/* link groups */}
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-10">
        <FooterColumn title={dict.nav.servicesAi} links={serviceLinks(AI_SERVICE_NAV)} />
        <FooterColumn title={dict.nav.servicesFoundation} links={[...serviceLinks(FOUNDATION_SERVICE_NAV), { href: href(routes.services), label: dict.common.allServices }]} />
        <FooterColumn title={dict.footer.resources} links={resources} />
        <FooterColumn
          title={dict.footer.company}
          links={company}
          extra={
            <AccountLinks
              variant="footer"
              links={{
                signIn: { href: href(routes.accountSignIn), label: dict.accountEntry.signIn },
                register: { href: href(routes.accountRegister), label: dict.accountEntry.createAccount },
              }}
            />
          }
        />
        <div>
          <FooterColumn title={dict.footer.legal} links={legal} />
        </div>
      </Container>

      <Container className="flex flex-col gap-2 border-t border-line-subtle py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}. {dict.footer.rights}
        </p>
        <p>{dict.footer.provisional}</p>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  columns = 1,
  extra,
}: {
  title: string;
  links: { href: string; label: string }[];
  columns?: 1 | 2;
  /** Extra list items rendered after the links (they appear only when their own condition holds). */
  extra?: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-caption font-semibold text-fg-muted">{title}</h2>
      <ul className={`mt-4 grid gap-x-8 gap-y-2.5 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-body-sm text-fg-secondary transition-colors hover:text-brand">
              {link.label}
            </Link>
          </li>
        ))}
        {extra}
      </ul>
    </div>
  );
}
