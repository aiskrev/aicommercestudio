import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminRoleContext } from "@/components/admin/AdminRole";
import { CatalogueEditor } from "@/components/admin/catalogue/CatalogueEditor";
import { CatalogueList } from "@/components/admin/catalogue/CatalogueList";
import { sampleEntity } from "@/components/admin/catalogue/test-fixtures";
import { adminDictionaries } from "@/i18n/admin";
import { ApiError } from "@/lib/admin-api";
import type { CatalogueEntity, CatalogueEntityPage, CatalogueOptions, StaffRole } from "@/lib/admin-types";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string, init?: RequestInit) => fetchMock(path, init),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const t = adminDictionaries.bg.catalogue;
const ID = "00000000-0000-4000-8000-000000000001";

const options: CatalogueOptions = {
  role: "admin",
  domains: [{ key: "commerce_engineering", code: "D", name_bg: "Инженеринг за електронна търговия", name_en: "Commerce Engineering" }],
  services: [
    { key: "seo", offering_type: "service", status: "published", name_bg: "SEO", name_en: "SEO" },
    { key: "analytics", offering_type: "service", status: "published", name_bg: "Анализи", name_en: "Analytics" },
    { key: "maintenance", offering_type: "service", status: "draft", name_bg: "Поддръжка", name_en: "Maintenance" },
  ],
  free_lead_categories: [],
};

function serveEditor(entity: CatalogueEntity, onWrite?: (path: string, init: RequestInit) => unknown) {
  fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") return onWrite?.(path, init);
    if (path === `/api/admin/catalogue/entities/${ID}`) return entity;
    if (path === "/api/admin/catalogue/options") return options;
    if (path.startsWith(`/api/admin/catalogue/entities/${ID}/checks`)) return { publishable: true, errors: [] };
    if (path.startsWith(`/api/admin/catalogue/entities/${ID}/history`)) return [];
    if (path.startsWith(`/api/admin/catalogue/entities/${ID}/preview`)) {
      return { locale: "bg", key: "seo", name: "SEO БГ", slug: "seo-slug", summary: "Публично резюме", body: "Текст", seo: { title: "T", description: "D" }, deliverables: [] };
    }
    throw new Error(`unexpected ${path}`);
  });
}

function renderAs(role: StaffRole, ui: ReactElement) {
  return render(<AdminRoleContext.Provider value={role}>{ui}</AdminRoleContext.Provider>);
}

afterEach(() => fetchMock.mockReset());

describe("catalogue list", () => {
  const page: CatalogueEntityPage = {
    items: [
      { id: "d1", type: "domain", key: "devops_sre", status: "published", offering_type: null, domain: "F", name_bg: "DevOps, SRE и наблюдаемост", name_en: "DevOps", revision: 1, published_revision: 1, has_unpublished_changes: false, updated_at: "2026-10-28T10:00:00Z", published_at: "2026-10-28T10:00:00Z" },
      { id: "s1", type: "service", key: "seo", status: "published", offering_type: "service", domain: "commerce_engineering", name_bg: "SEO оптимизация", name_en: "SEO", revision: 2, published_revision: 1, has_unpublished_changes: true, updated_at: "2026-10-28T11:00:00Z", published_at: "2026-10-28T10:00:00Z" },
      { id: "w1", type: "service", key: "seo_workshop", status: "draft", offering_type: "workshop", domain: "commerce_engineering", name_bg: "Среща за SEO миграция", name_en: "SEO migration session", revision: 1, published_revision: null, has_unpublished_changes: true, updated_at: "2026-10-28T12:00:00Z", published_at: null },
    ],
    total: 3,
    page: 1,
    page_size: 100,
  };

  it("lists entries with type, status and unpublished-change badges", async () => {
    fetchMock.mockResolvedValue(page);
    renderAs("admin", <CatalogueList />);
    const table = await screen.findByTestId("catalogue-table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText(t.types.domain)).toBeInTheDocument();
    expect(within(rows[1]).getByText(t.unpublished)).toBeInTheDocument();
    expect(within(rows[2]).getByText(t.types.workshop)).toBeInTheDocument();
    expect(within(rows[2]).getByText(t.status.draft)).toBeInTheDocument();
    expect(within(rows[2]).queryByText(t.unpublished)).not.toBeInTheDocument(); // drafts are unpublished by definition
    expect(screen.getByRole("link", { name: t.create })).toBeInTheDocument();
  });

  it("sends filters to the API and shows an empty state", async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    renderAs("viewer", <CatalogueList />);
    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.create })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.type), { target: { value: "workshop" } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("offering_type=workshop"), undefined));
    expect(fetchMock.mock.lastCall?.[0]).toContain("type=service");
    expect(await screen.findByText(t.emptyText)).toBeInTheDocument();
  });

  it("shows an error state with a retry", async () => {
    fetchMock.mockRejectedValue(new ApiError(500, "Сървърът не отговаря", {}, "internal_error", "req-1"));
    renderAs("admin", <CatalogueList />);
    expect(await screen.findByText("Сървърът не отговаря")).toBeInTheDocument();
  });
});

describe("catalogue editor", () => {
  it("edits both languages in tabs and saves with the revision", async () => {
    let body: unknown = null;
    serveEditor(sampleEntity(), (path, init) => {
      expect(path).toBe(`/api/admin/catalogue/entities/${ID}`);
      expect(new Headers(init.headers).get("If-Match")).toBe('"3"');
      body = JSON.parse(init.body as string);
      return sampleEntity({ revision: 4, has_unpublished_changes: true, translations: { ...sampleEntity().translations, en: { ...sampleEntity().translations.en, summary: "New summary" } } });
    });
    renderAs("admin", <CatalogueEditor id={ID} />);
    const save = await screen.findByRole("button", { name: t.save });
    expect(save).toBeDisabled(); // nothing to save yet

    fireEvent.click(screen.getByRole("tab", { name: new RegExp(t.locales.en) }));
    fireEvent.change(screen.getByLabelText(t.fields.summary), { target: { value: "New summary" } });
    expect(screen.getByText(t.unsavedBadge)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.publish })).toBeDisabled(); // save first
    fireEvent.click(save);

    expect(await screen.findByText(t.saved)).toBeInTheDocument();
    expect(body).toMatchObject({ translations: { en: { summary: "New summary" } }, related: ["analytics"] });
    expect(screen.queryByText(t.unsavedBadge)).not.toBeInTheDocument();
    expect(screen.getByText(t.unpublished)).toBeInTheDocument();
  });

  it("blocks markup before sending and shows server field errors at the field", async () => {
    const writes: string[] = [];
    serveEditor(sampleEntity(), (path) => {
      writes.push(path);
      throw new ApiError(422, "Моля, коригирайте маркираните полета.", { "translations.bg.slug": "Този адрес вече се използва." }, "validation_error");
    });
    renderAs("admin", <CatalogueEditor id={ID} />);
    const summary = await screen.findByLabelText(t.fields.summary);
    fireEvent.change(summary, { target: { value: "<script>alert(1)</script>" } });
    expect(screen.getByText(t.problems.markup)).toBeInTheDocument();
    expect(summary).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    expect(await screen.findByText(t.clientErrors)).toBeInTheDocument();
    expect(writes).toEqual([]);

    fireEvent.change(summary, { target: { value: "Plain summary" } });
    fireEvent.change(screen.getByLabelText(t.fields.slug), { target: { value: "taken-slug" } });
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    expect(await screen.findByText("Този адрес вече се използва.")).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.slug)).toHaveAttribute("aria-invalid", "true");
    expect(writes).toHaveLength(1);
  });

  it("warns before leaving with unsaved changes", async () => {
    serveEditor(sampleEntity());
    renderAs("admin", <CatalogueEditor id={ID} />);
    fireEvent.change(await screen.findByLabelText(t.fields.name), { target: { value: "Changed" } });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const back = screen.getByRole("link", { name: t.back });
    expect(fireEvent.click(back)).toBe(false); // navigation cancelled
    expect(confirm).toHaveBeenCalledWith(t.unsavedConfirm);
    confirm.mockRestore();
  });

  it("publishes, reports incomplete fields and offers a reload on conflicts", async () => {
    const calls: string[] = [];
    let attempt = 0;
    serveEditor(sampleEntity({ status: "draft", published_revision: null, has_unpublished_changes: true }), (path) => {
      calls.push(path);
      attempt += 1;
      if (attempt === 1) {
        throw new ApiError(422, "Записът не може да бъде публикуван.", { "translations.en.seo_description": "Полето е задължително за публикуване." }, "catalogue_incomplete");
      }
      if (attempt === 2) throw new ApiError(412, "Записът е променен от друг потребител.", {}, "revision_conflict");
      return sampleEntity();
    });
    renderAs("admin", <CatalogueEditor id={ID} />);
    fireEvent.click(await screen.findByRole("button", { name: t.publish }));
    expect(await screen.findByText("Записът не може да бъде публикуван.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(t.locales.en) }));
    expect(screen.getByText("Полето е задължително за публикуване.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.publish }));
    expect(await screen.findByRole("button", { name: t.reload })).toBeInTheDocument();
    expect(calls).toEqual([`/api/admin/catalogue/entities/${ID}/publish`, `/api/admin/catalogue/entities/${ID}/publish`]);
  });

  it("shows the preview of the working copy", async () => {
    serveEditor(sampleEntity());
    renderAs("admin", <CatalogueEditor id={ID} />);
    fireEvent.click(await screen.findByRole("button", { name: t.preview }));
    expect(await screen.findByTestId("catalogue-preview")).toHaveTextContent("Публично резюме");
  });

  it("is read only for viewers and offers no write actions", async () => {
    serveEditor(sampleEntity({ permissions: [] }));
    renderAs("viewer", <CatalogueEditor id={ID} />);
    expect(await screen.findByText(t.readOnlyText)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.name)).toBeDisabled();
    for (const name of [t.save, t.publish, t.archive]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("manages related entries and list items for both languages", async () => {
    let body: { related: string[]; deliverables: unknown[] } | null = null;
    serveEditor(sampleEntity(), (_path, init) => {
      body = JSON.parse(init.body as string);
      return sampleEntity({ revision: 4 });
    });
    renderAs("admin", <CatalogueEditor id={ID} />);
    const related = await screen.findByTestId("related-editor");
    fireEvent.change(within(related).getByLabelText(t.chooseRelated), { target: { value: "maintenance" } });
    fireEvent.click(within(related).getByRole("button", { name: t.addRelated }));
    fireEvent.click(within(related).getAllByRole("button", { name: t.moveUp })[1]);
    const deliverables = screen.getByTestId("items-deliverables");
    fireEvent.click(within(deliverables).getByRole("button", { name: t.addItem }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    await screen.findByText(t.saved);
    expect(body!.related).toEqual(["maintenance", "analytics"]);
    expect(body!.deliverables).toHaveLength(2);
  });
});
