import type { IconName } from "@/components/ui/Icon";
import type { PreviewKind } from "@/components/v5/UiPreview";
import { domainByKey, getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import type { Dictionary } from "@/i18n";
import { type Locale, localizePath } from "@/i18n/config";
import { type DomainKey, domainDefinition, isDomainPublished } from "@/lib/domains";
import { routes } from "@/lib/routes";
import { isToolAvailable, type ToolKey, toolByKey, toolHrefs } from "@/lib/tools";

/**
 * Header navigation, V5 (docs/V5_LINK_AUDIT.md). Grouped by what a visitor wants, not by the internal taxonomy:
 * Website development ▾ · E-commerce ▾ · AI & automation ▾ · Maintenance ▾ · Packages & pricing ▾ · Studio ▾ and the
 * quote button. Built on the server from the route registry, the domain registry, the tool flags and the content,
 * so a menu never lists an unpublished hub, an unavailable tool or a feature behind a switched-off flag (the
 * configurator, the quote basket, quotations and customer accounts are never listed here; the sign-in icon is
 * drawn separately and only while accounts are on).
 */

export interface NavItem {
  href: string;
  label: string;
}

export interface NavLink extends NavItem {
  description?: string;
  icon?: IconName;
}

export interface NavColumn {
  title: string;
  items: NavLink[];
}

export interface NavMenu {
  id: "websites" | "ecommerce" | "ai" | "maintenance" | "pricing" | "studio";
  label: string;
  /** Overview page of the group (first link of the panel). */
  overview: NavLink;
  columns: NavColumn[];
  featured: { title: string; text: string; cta: string; href: string; preview: PreviewKind };
}

export interface Navigation {
  menus: NavMenu[];
  /** Quick-start strip: the service selector and the quote form (Future Commerce). */
  quick: { title: string; text: string; selector: NavItem; quote: NavItem };
  /** Header button: the working quote path. */
  cta: NavItem;
}

/** Anchor on the care plans page where the recurring-services matrix starts. */
export const CARE_MATRIX_ANCHOR = "ongoing-services";

/** Anchor of the service selector on the services overview page. */
export const SELECTOR_ANCHOR = "selector";

/** Icons of the hub offers (website types and store platforms) in the menus. */
const OFFER_ICONS: Record<string, IconName> = {
  landing: "target",
  static: "fileText",
  cms: "pen",
  interactive: "activity",
  corporate: "building",
  redesign: "refresh",
  shopify: "store",
  woocommerce: "cart",
  custom: "layers",
};

export function buildNavigation(locale: Locale, dict: Dictionary): Navigation {
  const href = (path: string) => localizePath(locale, path);
  const content = getContent(locale);
  const { v5, tools, workshops, demoCentre, carePlans, projectPackages, pricingPage, reference, aiSolutions } = content;
  const nav = v5.nav;
  const toolLinks = toolHrefs(locale);

  const service = (key: ServiceKey, icon?: IconName): NavLink => {
    const item = serviceByKey(locale, key);
    return { href: href(routes.service(item.slug)), label: item.shortTitle, icon: icon ?? item.icon };
  };
  const domains = (keys: DomainKey[]): NavLink[] =>
    keys.filter(isDomainPublished).map((key) => {
      const domain = domainByKey(locale, key);
      return { href: href(routes.service(domain.slug)), label: domain.name, description: domain.summary, icon: domainDefinition(key).icon };
    });
  const tool = (key: ToolKey): NavLink[] => {
    const link = toolLinks[key];
    if (!link) return [];
    const item = tools.items.find((entry) => entry.key === key)!;
    return [{ href: link, label: item.title, icon: item.icon }];
  };
  const hubAnchor = (path: string, id: string) => `${href(path)}#${id}`;

  const websitesHub = href(routes.websites);
  const ecommerceHub = href(routes.ecommerce);

  const menus: NavMenu[] = [
    {
      id: "websites",
      label: nav.websites,
      overview: { href: websitesHub, label: v5.websites.title, description: v5.websites.offersLead, icon: "globe" },
      columns: [
        {
          title: nav.groups.websiteTypes,
          items: v5.websites.offers.map((offer) => ({ href: hubAnchor(routes.websites, offer.id), label: offer.name, description: offer.value, icon: OFFER_ICONS[offer.id] })),
        },
        {
          title: nav.groups.websiteServices,
          items: [service("business_websites"), service("portals_web_apps"), service("security_performance")],
        },
      ],
      featured: { ...nav.featured.websites, href: hubAnchor(routes.websites, "compare"), preview: "static" },
    },
    {
      id: "ecommerce",
      label: nav.ecommerce,
      overview: { href: ecommerceHub, label: v5.ecommerce.title, description: v5.ecommerce.offersLead, icon: "cart" },
      columns: [
        {
          title: nav.groups.storePlatforms,
          items: v5.ecommerce.offers.map((offer) => ({ href: hubAnchor(routes.ecommerce, offer.id), label: offer.name, description: offer.value, icon: OFFER_ICONS[offer.id] })),
        },
        {
          title: nav.groups.storeServices,
          items: [
            service("store_development"),
            service("payments_subscriptions"),
            service("integrations"),
            service("maintenance"),
            service("analytics"),
            service("seo"),
            ...domains(["commerce_engineering"]),
          ],
        },
      ],
      featured: { ...nav.featured.ecommerce, href: hubAnchor(routes.ecommerce, "costs"), preview: "store" },
    },
    {
      id: "ai",
      label: nav.ai,
      overview: { href: href(routes.aiSolutions), label: nav.labels.aiOverview, description: aiSolutions.lead, icon: "sparkles" },
      columns: [
        {
          title: nav.groups.aiServices,
          items: [
            ...domains(["ai_strategy", "ai_agents_automation", "ai_applications", "data_integration", "ai_governance"]),
            service("ai_agents"),
            service("automation"),
            service("ai_tools"),
          ],
        },
        {
          title: nav.groups.aiStart,
          items: [
            ...tool("advisor"),
            ...tool("readiness"),
            ...tool("finder"),
            { href: href(routes.tools), label: nav.labels.tools, icon: "wrench" },
            service("audit"),
            { href: href(routes.workshops), label: workshops.page.title, icon: "clipboard" },
            ...domains(["advisory_enablement"]),
            ...(isToolAvailable(toolByKey("agents")) ? [{ href: href(routes.agentLibrary), label: tools.items.find((item) => item.key === "agents")!.title, icon: "bot" as const }] : []),
          ],
        },
      ],
      featured: { ...nav.featured.ai, href: toolLinks.advisor ?? href(routes.tools), preview: "ai" },
    },
    {
      id: "maintenance",
      label: nav.maintenance,
      overview: { href: href(routes.carePlans), label: carePlans.title, description: carePlans.lead, icon: "wrench" },
      columns: [
        {
          title: nav.groups.care,
          items: [service("maintenance"), service("integration_care"), service("ai_managed"), service("security_performance"), service("seo")],
        },
        { title: nav.groups.cloud, items: domains(["cloud_platform", "devops_sre", "managed_operations"]) },
      ],
      featured: { ...nav.featured.maintenance, href: `${href(routes.carePlans)}#${CARE_MATRIX_ANCHOR}`, preview: "portal" },
    },
    {
      id: "pricing",
      label: nav.pricing,
      overview: { href: href(routes.pricing), label: pricingPage.navLabel, description: pricingPage.lead, icon: "chart" },
      columns: [
        {
          title: nav.groups.packages,
          items: [
            { href: href(routes.projectPackages), label: projectPackages.navLabel, description: projectPackages.lead, icon: "layers" },
            { href: href(routes.carePlans), label: carePlans.title, description: carePlans.lead, icon: "wrench" },
            { href: href(routes.pricing), label: pricingPage.navLabel, description: pricingPage.lead, icon: "chart" },
          ],
        },
      ],
      featured: { ...nav.featured.pricing, href: href(`${routes.contact}?tip=oferta`), preview: "interactive" },
    },
    {
      id: "studio",
      label: nav.studio,
      overview: { href: href(routes.about), label: dict.nav.aboutUs, description: content.about.lead, icon: "users" },
      columns: [
        {
          title: nav.groups.examples,
          items: [
            { href: href(routes.demoCentre), label: nav.labels.examples, description: demoCentre.lead, icon: "eye" },
            { href: href(routes.scenarios), label: reference.scenarios.title, icon: "target" },
            { href: href(routes.patterns), label: reference.patterns.title, icon: "workflow" },
            { href: href(routes.insights), label: dict.nav.insights, icon: "fileText" },
          ],
        },
        {
          title: nav.groups.company,
          items: [
            { href: href(routes.founder), label: dict.nav.founder, icon: "users" },
            { href: href(routes.process), label: dict.nav.approach, icon: "workflow" },
            { href: href(routes.industries), label: dict.nav.industries, icon: "building" },
            { href: href(routes.services), label: nav.allServices, icon: "list" },
            { href: href(routes.contact), label: nav.contact, icon: "mail" },
          ],
        },
      ],
      featured: { ...nav.featured.studio, href: href(routes.demoCentre), preview: "portal" },
    },
  ];

  const cta = { href: href(`${routes.contact}?tip=oferta`), label: nav.quoteCta };
  const quick = { title: nav.quick.title, text: nav.quick.text, selector: { href: `${href(routes.services)}#${SELECTOR_ANCHOR}`, label: nav.quick.selector }, quote: cta };
  return { menus, quick, cta };
}

/** Every href of the navigation (tests and the link audit). */
export function navigationHrefs(navigation: Navigation): string[] {
  return [
    ...navigation.menus.flatMap((menu) => [menu.overview.href, ...menu.columns.flatMap((column) => column.items.map((item) => item.href)), menu.featured.href]),
    navigation.quick.selector.href,
    navigation.cta.href,
  ];
}
