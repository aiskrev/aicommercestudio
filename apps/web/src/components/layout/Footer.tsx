import Link from "next/link";

import { Logo } from "@/components/layout/Logo";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container } from "@/components/ui/primitives";
import type { Service } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export function Footer({ locale, dict, services }: { locale: Locale; dict: Dictionary; services: Service[] }) {
  const href = (path: string) => localizePath(locale, path);
  const company = [
    { href: href(routes.aiSolutions), label: dict.nav.aiSolutions },
    { href: href(routes.advisor), label: dict.nav.advisor },
    { href: href(routes.industries), label: dict.nav.industries },
    { href: href(routes.process), label: dict.nav.process },
    { href: href(routes.about), label: dict.nav.about },
    { href: href(routes.insights), label: dict.nav.insights },
    { href: href(routes.contact), label: dict.nav.contact },
  ];
  const legal = [
    { href: href(routes.privacy), label: dict.footer.privacy },
    { href: href(routes.cookies), label: dict.footer.cookies },
    { href: href(routes.terms), label: dict.footer.terms },
  ];

  return (
    <footer className="relative mt-auto border-t border-line-subtle bg-ink-950">
      {/* statement + primary action */}
      <Container className="grid gap-8 border-b border-line-subtle py-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:py-16">
        <div>
          <Logo href={href(routes.home)} gradientId="logo-gradient-footer" />
          <p className="mt-6 max-w-2xl font-display text-[clamp(1.35rem,1.1rem+0.8vw,1.75rem)] font-bold leading-snug tracking-[-0.02em] text-fg">
            {dict.footer.tagline}
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:items-end">
          <ButtonLink href={href(routes.contact)} variant="secondary" icon="arrowRight">
            {dict.nav.cta}
          </ButtonLink>
          {(site.contactEmail || site.contactPhone) && (
            <ul className="grid gap-2 text-sm lg:text-right">
              {site.contactEmail && (
                <li>
                  <a href={`mailto:${site.contactEmail}`} className="inline-flex items-center gap-2 text-fg-secondary hover:text-fg">
                    <Icon name="mail" className="h-4 w-4 text-brand" />
                    {site.contactEmail}
                  </a>
                </li>
              )}
              {site.contactPhone && (
                <li>
                  <a href={`tel:${site.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-fg-secondary hover:text-fg">
                    <Icon name="phone" className="h-4 w-4 text-brand" />
                    {site.contactPhone}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
      </Container>

      {/* link groups */}
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <FooterColumn
          title={dict.footer.services}
          links={services.map((s) => ({ href: href(routes.service(s.slug)), label: s.shortTitle }))}
          columns={2}
        />
        <FooterColumn title={dict.footer.company} links={company} />
        <div>
          <FooterColumn title={dict.footer.legal} links={legal} />
          <p className="mt-5 max-w-xs text-xs leading-relaxed text-fg-subtle">{dict.footer.draftNote}</p>
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
}: {
  title: string;
  links: { href: string; label: string }[];
  columns?: 1 | 2;
}) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-fg-muted">{title}</h2>
      <ul className={`mt-4 grid gap-x-8 gap-y-2.5 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[15px] text-fg-secondary transition-colors hover:text-brand">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
