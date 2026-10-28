import type { IconName } from "@/components/ui/Icon";
import { domainByKey, getContent, serviceByKey } from "@/content";
import type { Dictionary } from "@/i18n";
import { type Locale, localizePath } from "@/i18n/config";
import { BANDS, type DomainBand, domainsInBand } from "@/lib/domains";
import { routes } from "@/lib/routes";
import { isToolAvailable, type ToolKey, toolByKey, toolHrefs } from "@/lib/tools";

/**
 * Header navigation (docs/INFORMATION_ARCHITECTURE_V2.md §4.1–4.3, phase IA-1):
 * Services ▾ (mega-menu of the published domains in three bands + "Start here"), Solutions ▾,
 * Tools, Industries, Insights, Company ▾ and the consultation CTA. Built on the server from the
 * domain registry and the content, so the header never lists an unpublished hub or an unavailable tool.
 */

export interface NavItem {
  href: string;
  label: string;
}

export interface NavDomain extends NavItem {
  description: string;
  icon: IconName;
  /** Existing service pages whose primary domain this is (secondary links). */
  services: NavItem[];
}

export interface NavBand {
  key: DomainBand;
  title: string;
  domains: NavDomain[];
}

export interface NavStartItem extends NavItem {
  description: string;
  icon: IconName;
}

export interface ServiceMenu extends NavItem {
  bands: NavBand[];
  startHere: { title: string; items: NavStartItem[] };
  allLabel: string;
}

export type NavEntry = ({ kind: "link" } & NavItem) | { kind: "menu"; id: string; label: string; items: NavItem[] };

/** Tools offered under "Start here", in order; unavailable ones are left out. */
const START_TOOLS: ToolKey[] = ["readiness", "finder"];

export function buildNavigation(locale: Locale, dict: Dictionary): { services: ServiceMenu; entries: NavEntry[] } {
  const href = (path: string) => localizePath(locale, path);
  const { tools } = getContent(locale);
  const toolLinks = toolHrefs(locale);
  const serviceLink = (key: Parameters<typeof serviceByKey>[1]): NavItem => {
    const service = serviceByKey(locale, key);
    return { href: href(routes.service(service.slug)), label: service.shortTitle };
  };

  const bands: NavBand[] = BANDS.map((band) => ({
    key: band,
    title: dict.domain.bands[band].title,
    domains: domainsInBand(band)
      .filter((definition) => definition.published)
      .map((definition) => {
        const domain = domainByKey(locale, definition.key);
        return {
          href: href(routes.service(domain.slug)),
          label: domain.name,
          description: domain.summary,
          icon: definition.icon,
          services: definition.primaryServices.map(serviceLink),
        };
      }),
  })).filter((band) => band.domains.length > 0);

  const audit = serviceByKey(locale, "audit");
  const startHere: NavStartItem[] = [
    { ...serviceLink("audit"), description: audit.summary, icon: audit.icon },
    ...START_TOOLS.filter((key) => toolLinks[key]).map((key) => {
      const tool = tools.items.find((item) => item.key === key)!;
      return { href: toolLinks[key]!, label: tool.title, description: tool.description, icon: tool.icon };
    }),
  ];

  const solutions: NavItem[] = [
    { href: href(routes.aiSolutions), label: dict.nav.aiSolutions },
    ...(isToolAvailable(toolByKey("agents"))
      ? [{ href: href(routes.agentLibrary), label: tools.items.find((item) => item.key === "agents")!.title }]
      : []),
  ];

  return {
    services: {
      href: href(routes.services),
      label: dict.nav.services,
      allLabel: dict.common.allServices,
      bands,
      startHere: { title: dict.nav.startHere, items: startHere },
    },
    entries: [
      { kind: "menu", id: "solutions", label: dict.nav.solutions, items: solutions },
      { kind: "link", href: href(routes.tools), label: dict.nav.tools },
      { kind: "link", href: href(routes.industries), label: dict.nav.industries },
      { kind: "link", href: href(routes.insights), label: dict.nav.insights },
      {
        kind: "menu",
        id: "company",
        label: dict.nav.company,
        items: [
          { href: href(routes.about), label: dict.nav.aboutUs },
          { href: href(routes.founder), label: dict.nav.founder },
          { href: href(routes.process), label: dict.nav.approach },
          { href: href(routes.contact), label: dict.nav.contact },
        ],
      },
    ],
  };
}
