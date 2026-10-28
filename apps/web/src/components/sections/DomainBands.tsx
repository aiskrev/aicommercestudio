import Link from "next/link";

import { StatusChip } from "@/components/sections/StatusChip";
import { Icon } from "@/components/ui/Icon";
import { domainByKey, serviceByKey } from "@/content";
import type { Dictionary } from "@/i18n";
import { type Locale, localizePath } from "@/i18n/config";
import { BANDS, domainsInBand, domainStatus } from "@/lib/domains";
import { routes } from "@/lib/routes";

/**
 * Services index (docs/CONTENT_STRATEGY_BG_EN.md §5.3): the published domains in their three bands.
 * Each card names the domain, its highest delivery status and the existing services inside it.
 * The domain heading is a link of its own (not a card-wide link), so the service links stay usable.
 */
export function DomainBands({ locale, labels }: { locale: Locale; labels: Dictionary["domain"] }) {
  const href = (path: string) => localizePath(locale, path);

  return (
    <div className="grid gap-14">
      {BANDS.map((band) => {
        const domains = domainsInBand(band).filter((definition) => definition.published);
        if (domains.length === 0) return null;
        return (
          <div key={band}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
              <h3 className="shrink-0 text-[1.0625rem] font-semibold text-fg">{labels.bands[band].title}</h3>
              <p className="text-[15px] text-fg-muted">{labels.bands[band].lead}</p>
            </div>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {domains.map((definition) => {
                const domain = domainByKey(locale, definition.key);
                const status = domainStatus(definition.key);
                const services = [...definition.primaryServices, ...definition.alsoListed];
                return (
                  <li key={definition.key} className="min-w-0">
                    <article className="card flex h-full flex-col p-6">
                      <div className="flex items-start gap-4">
                        <span
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand"
                          aria-hidden="true"
                        >
                          <Icon name={definition.icon} className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h4 className="t-h3">
                            <Link href={href(routes.service(domain.slug))} className="group inline-flex items-start gap-1.5 hover:text-brand">
                              {domain.name}
                              <Icon name="arrowRight" className="arrow-nudge mt-1 h-4 w-4 shrink-0 text-fg-subtle group-hover:text-brand" />
                            </Link>
                          </h4>
                          <StatusChip status={status} label={labels.status[status]} className="mt-2" />
                        </div>
                      </div>
                      <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">{domain.summary}</p>
                      {services.length > 0 && (
                        <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-4 text-sm" aria-label={labels.servicesTitle}>
                          {services.map((key) => {
                            const service = serviceByKey(locale, key);
                            return (
                              <li key={key}>
                                <Link href={href(routes.service(service.slug))} className="link inline-flex min-h-6 items-center">
                                  {service.shortTitle}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
