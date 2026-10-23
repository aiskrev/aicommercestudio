import Link from "next/link";

import { Logo } from "@/components/layout/Logo";
import { Icon } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";
import type { Service } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export function Footer({ locale, dict, services }: { locale: Locale; dict: Dictionary; services: Service[] }) {
  const href = (path: string) => localizePath(locale, path);
  const company = [
    { href: href(routes.aiSolutions), label: dict.nav.aiSolutions },
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
    <footer className="relative mt-auto border-t border-white/[0.06] bg-ink-950">
      <div className="divider-glow" aria-hidden="true" />
      <Container className="grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo href={href(routes.home)} />
          <p className="mt-4 max-w-sm leading-relaxed text-slate-400">{dict.footer.tagline}</p>
          {(site.contactEmail || site.contactPhone) && (
            <ul className="mt-5 grid gap-2 text-sm">
              {site.contactEmail && (
                <li>
                  <a href={`mailto:${site.contactEmail}`} className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                    <Icon name="mail" className="h-4 w-4 text-cyan-300" />
                    {site.contactEmail}
                  </a>
                </li>
              )}
              {site.contactPhone && (
                <li>
                  <a href={`tel:${site.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                    <Icon name="phone" className="h-4 w-4 text-cyan-300" />
                    {site.contactPhone}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
        <FooterColumn
          title={dict.footer.services}
          links={services.map((s) => ({ href: href(routes.service(s.slug)), label: s.shortTitle }))}
        />
        <FooterColumn title={dict.footer.company} links={company} />
        <div>
          <FooterColumn title={dict.footer.legal} links={legal} />
          <p className="mt-4 text-xs leading-relaxed text-slate-500">{dict.footer.draftNote}</p>
        </div>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-white/[0.06] py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}. {dict.footer.rights}
        </p>
        <p>{dict.footer.provisional}</p>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-4 grid gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
