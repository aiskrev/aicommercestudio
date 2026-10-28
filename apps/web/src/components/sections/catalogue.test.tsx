import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CatalogueOfferings } from "@/components/sections/Catalogue";
import { CatalogueBrowser } from "@/components/sections/CatalogueBrowser";
import { OfferingPage } from "@/components/sections/OfferingPage";
import { getDictionary } from "@/i18n";
import { type CatalogueDetail, type CatalogueEntry, contentEntries } from "@/lib/catalogue";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));

const CYRILLIC = /[Ѐ-ӿ]/;

const workshop: CatalogueEntry = {
  key: "migration_workshop",
  offeringType: "workshop",
  slug: "migration-workshop",
  alternateSlugs: { bg: "rabotna-sreshta-migratsiya", en: "migration-workshop" },
  name: "Migration workshop",
  shortName: null,
  summary: "Half a day with your team before a platform switch.",
  deliveryStatus: "available",
  domain: "commerce_engineering",
  isEntryOffer: false,
  duration: { minDays: 0.5, maxDays: 1 },
  origin: "catalogue",
};

const assessment: CatalogueEntry = {
  ...workshop,
  key: "governance_review",
  offeringType: "assessment",
  slug: "governance-review",
  name: "Governance review",
  domain: "ai_governance",
  deliveryStatus: "custom",
  duration: { minDays: 3, maxDays: 5 },
};

function browser(entries: CatalogueEntry[]) {
  const dict = getDictionary("en");
  return render(
    <CatalogueBrowser
      entries={entries}
      hrefs={Object.fromEntries(entries.map((e) => [e.key, `/en/services/${e.slug}`]))}
      domains={[
        { key: "ai_agents_automation", name: "AI agents and automation" },
        { key: "ai_governance", name: "AI governance" },
        { key: "commerce_engineering", name: "Commerce engineering" },
        { key: "cloud_platform", name: "Cloud platform" },
      ]}
      locale="en"
      labels={dict.catalogue}
      statusLabels={dict.domain.status}
    />,
  );
}

afterEach(() => {
  revalidateTag.mockReset();
  delete process.env.CATALOGUE_REVALIDATE_SECRET;
});

describe("catalogue browser", () => {
  const entries = [...contentEntries("en"), workshop, assessment];

  it("shows every entry with a live count, and filters by type and domain", () => {
    browser(entries);
    const count = screen.getByTestId("catalogue-count");
    expect(count).toHaveAttribute("aria-live", "polite");
    expect(count).toHaveTextContent(`Entries shown: ${entries.length}`);
    expect(screen.getAllByTestId("offering-card")).toHaveLength(entries.length);

    const types = screen.getByRole("group", { name: "Type" });
    const workshops = within(types).getByRole("button", { name: "Workshops" });
    expect(workshops).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(workshops);
    expect(workshops).toHaveAttribute("aria-pressed", "true");
    expect(count).toHaveTextContent("Entries shown: 1");
    expect(screen.getByRole("link", { name: "Migration workshop" })).toHaveAttribute("href", "/en/services/migration-workshop");
    expect(screen.getByText("0.5–1")).toBeInTheDocument();

    fireEvent.click(within(types).getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "ai_governance" } });
    expect(count).toHaveTextContent("Entries shown: 1");
    expect(screen.getByText("Custom engagement")).toBeInTheDocument(); // the status label, not colour alone
  });

  it("offers only the domains and types that have entries, and an empty state with a reset", () => {
    browser(entries);
    const select = screen.getByLabelText("Domain");
    expect(within(select).queryByRole("option", { name: "Cloud platform" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Assessments" }));
    fireEvent.change(select, { target: { value: "commerce_engineering" } });
    expect(screen.getByText("No published entries match this selection.")).toBeInTheDocument();
    expect(screen.queryAllByTestId("offering-card")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getAllByTestId("offering-card")).toHaveLength(entries.length);
  });

  it("has no type filter when only services are published", () => {
    browser(contentEntries("en"));
    expect(screen.queryByRole("group", { name: "Type" })).toBeNull();
  });
});

describe("assessments and workshops of a domain", () => {
  it("states plainly when none are published and offers a contact path", () => {
    const dict = getDictionary("bg");
    render(
      <CatalogueOfferings
        id="t"
        entries={[]}
        hrefFor={() => "/x"}
        locale="bg"
        labels={dict.catalogue}
        statusLabels={dict.domain.status}
        contactHref="/bg/kontakti?usluga=seo"
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Оценки и работни срещи" })).toBeInTheDocument();
    expect(screen.getByTestId("offerings-empty")).toHaveTextContent("все още няма публикувани оценки");
    expect(screen.getByRole("link", { name: "Заявете разговор" })).toHaveAttribute("href", "/bg/kontakti?usluga=seo");
  });

  it("links each published entry", () => {
    const dict = getDictionary("en");
    render(
      <CatalogueOfferings
        id="t"
        entries={[workshop]}
        hrefFor={(e) => `/en/services/${e.slug}`}
        locale="en"
        labels={dict.catalogue}
        statusLabels={dict.domain.status}
        contactHref="/en/contact"
      />,
    );
    expect(screen.getByRole("link", { name: "Migration workshop" })).toHaveAttribute("href", "/en/services/migration-workshop");
    expect(screen.queryByTestId("offerings-empty")).toBeNull();
  });
});

describe("catalogue-only entry page", () => {
  const detail: CatalogueDetail = {
    ...workshop,
    body: "We review redirects first.\n\nThen structured data and tracking.",
    seo: { title: "SEO migration workshop", description: "A half-day workshop that prepares a store migration." },
    capabilities: [{ title: "Redirect review", description: "Every indexed URL gets a target." }],
    deliverables: ["A redirect map"],
    related: {
      services: [{ key: "seo", offeringType: "service", slug: "seo-optimization", name: "SEO optimization" }],
      assessments: [],
      workshops: [],
    },
  };

  it("renders the published texts, the format, related services and the managed follow-up", () => {
    render(<OfferingPage entry={detail} locale="en" dict={getDictionary("en")} />);
    expect(screen.getByRole("heading", { level: 1, name: "Migration workshop" })).toBeInTheDocument();
    expect(screen.getByText("Then structured data and tracking.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Redirect review" })).toBeInTheDocument();
    expect(screen.getByText("A redirect map")).toBeInTheDocument();
    expect(screen.getByText("0.5–1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SEO optimization" })).toHaveAttribute("href", "/en/services/seo-optimization");
    expect(screen.getByTestId("managed-relation")).toBeInTheDocument();
    // The contact path pre-selects the domain's lead category.
    expect(screen.getAllByRole("link", { name: "Book a consultation" })[0].getAttribute("href")).toMatch(/^\/en\/contact\?service=/);
    expect(document.body.textContent).not.toMatch(CYRILLIC);
  });

  it("has no managed follow-up inside the managed operations domain", () => {
    render(<OfferingPage entry={{ ...detail, domain: "managed_operations" }} locale="en" dict={getDictionary("en")} />);
    expect(screen.queryByTestId("managed-relation")).toBeNull();
  });
});

describe("on-demand revalidation endpoint", () => {
  const call = async (secret?: string) => {
    const { POST } = await import("@/app/api/catalogue-revalidate/route");
    const headers = new Headers(secret === undefined ? {} : { "x-revalidate-secret": secret });
    return POST(new Request("http://web/api/catalogue-revalidate", { method: "POST", headers }) as never);
  };

  it("does not exist without a configured secret", async () => {
    expect((await call("anything")).status).toBe(404);
    process.env.CATALOGUE_REVALIDATE_SECRET = "too-short";
    expect((await call("too-short")).status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("requires the exact secret and then expires the catalogue tag", async () => {
    process.env.CATALOGUE_REVALIDATE_SECRET = "0123456789abcdef0123";
    expect((await call()).status).toBe(401);
    expect((await call("0123456789abcdef012")).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    const ok = await call("0123456789abcdef0123");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(revalidateTag).toHaveBeenCalledWith("catalogue", { expire: 0 });
  });
});
