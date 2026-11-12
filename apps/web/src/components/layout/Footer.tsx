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
import { SELECTOR_ANCHOR } from "@/lib/site-nav";
import { company } from "@/lib/company";
import { site } from "@/lib/site";

/**
 * Footer, V5: the same groups as the header menus (docs/V5_LINK_AUDIT.md) and every destination of the previous
 * footer. Contact details come from `ContactDetails` (protected, CLAUDE.md); account links appear only while
 * customer accounts are switched on.
 */
export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const href = (path: string) => localizePath(locale, path);
  const serviceLinks = (keys: ServiceKey[]) =>
    keys.map((key) => {
      const service = serviceByKey(locale, key);
      return { href: href(routes.service(service.slug)), label: service.shortTitle };
    });
  const { workshops, reference, demoCentre, carePlans, projectPackages, pricingPage, v5 } = getContent(locale);
  const websites = [{ href: href(routes.websites), label: v5.nav.websites }, ...serviceLinks(["business_websites", "portals_web_apps", "security_performance"])];
  const stores = [
    { href: href(routes.ecommerce), label: v5.nav.ecommerce },
    ...serviceLinks(["store_development", "payments_subscriptions", ...FOUNDATION_SERVICE_NAV]),
  ];
  const ai = [{ href: href(routes.aiSolutions), label: dict.nav.aiSolutions }, ...serviceLinks(AI_SERVICE_NAV), { href: href(routes.tools), label: dict.nav.tools }];
  const pricing = [
    { href: href(routes.projectPackages), label: projectPackages.navLabel },
    { href: href(routes.pricing), label: pricingPage.navLabel },
    { href: href(routes.carePlans), label: carePlans.title },
    { href: href(routes.services), label: dict.common.allServices },
  ];
  const studio = [
    { href: href(routes.about), label: dict.nav.about },
    { href: href(routes.process), label: dict.nav.approach },
    { href: href(routes.industries), label: dict.nav.industries },
    { href: href(routes.demoCentre), label: demoCentre.eyebrow },
    { href: href(routes.workshops), label: workshops.page.title },
    { href: href(routes.scenarios), label: reference.scenarios.title },
    { href: href(routes.patterns), label: reference.patterns.title },
    { href: href(routes.insights), label: dict.nav.insights },
    { href: href(routes.contact), label: dict.nav.contact },
  ];
  const legal = [
    { href: href(routes.privacy), label: dict.footer.privacy },
    { href: href(routes.cookies), label: dict.footer.cookies },
    { href: href(routes.terms), label: dict.footer.terms },
    { href: href(routes.subscriptionTerms), label: dict.footer.subscriptionTerms },
    { href: href(routes.withdrawalInfo), label: dict.footer.withdrawal },
  ];

  return (
    <footer className="relative mt-auto border-t border-line-subtle bg-ink-950">
      {/* statement + primary action */}
      <Container size="wide" className="py-12 lg:py-16">
        <div className="fc-cta grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <Logo href={href(routes.home)} />
            <p className="t-h3-lg mt-6 max-w-2xl text-fg">{dict.footer.tagline}</p>
          </div>
          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <ButtonLink href={`${href(routes.services)}#${SELECTOR_ANCHOR}`} variant="secondary" icon="target">
                {v5.nav.quick.selector}
              </ButtonLink>
              <ButtonLink href={href(`${routes.contact}?tip=oferta`)} icon="arrowRight">
                {v5.nav.quoteCta}
              </ButtonLink>
            </div>
            <ContactDetails labels={dict.contactDetails} align="end" />
          </div>
        </div>
      </Container>

      {/* link groups */}
      <Container size="wide" className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-8" data-testid="footer-groups">
        <FooterColumn title={v5.nav.websites} links={websites} />
        <FooterColumn title={v5.nav.ecommerce} links={stores} />
        <FooterColumn title={v5.nav.ai} links={ai} />
        <FooterColumn title={v5.nav.pricing} links={pricing} />
        <FooterColumn
          title={v5.nav.studio}
          links={studio}
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
        <FooterColumn title={dict.footer.legal} links={legal} />
      </Container>

      <Container size="wide" className="flex flex-col gap-2 border-t border-line-subtle py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}. {dict.footer.rights}
        </p>
        <p>
          {dict.footer.provisional
            .replace("{entity}", locale === "bg" ? company.legalNameBg : company.legalNameEn)
            .replace("{uic}", company.uic)}
        </p>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  extra,
}: {
  title: string;
  links: { href: string; label: string }[];
  /** Extra list items rendered after the links (they appear only when their own condition holds). */
  extra?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-caption font-semibold text-fg-muted">{title}</h2>
      <ul className="mt-4 grid gap-y-2.5">
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
