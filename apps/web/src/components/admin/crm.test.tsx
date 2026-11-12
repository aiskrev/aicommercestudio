import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Crm } from "@/components/admin/Crm";
import { LeadCrm } from "@/components/admin/LeadCrm";
import { adminDictionaries } from "@/i18n/admin";

const calls: { path: string; init?: RequestInit }[] = [];
let routes: Record<string, unknown> = {};
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    const key = Object.keys(routes).find((candidate) => path.startsWith(candidate));
    if (!key) throw new Error(`unexpected ${path}`);
    return routes[key];
  },
}));

const t = adminDictionaries.bg.crm;
const ADMIN = { id: "a1", name: "Ани Админ" };
const OVERVIEW = {
  period_days: 30,
  since: "2026-10-12T00:00:00Z",
  enquiries_total: 12,
  enquiries_in_period: 5,
  enquiries_by_status: { NEW: 3, CONTACTED: 4, QUALIFIED: 1, PROPOSAL: 1, WON: 2, LOST: 1 },
  unassigned_open_enquiries: 2,
  open_opportunities: 4,
  proposals_approved: 2,
  quotations_pending: 1,
  quotations_accepted: 1,
  projects_active: 3,
  projects_by_status: { in_progress: 2, approved: 1 },
  follow_ups_open: 6,
  follow_ups_overdue: 2,
  follow_ups_due_this_week: 3,
  owners: [
    { owner: ADMIN, open_enquiries: 4, open_tasks: 5, overdue_tasks: 2 },
    { owner: null, open_enquiries: 2, open_tasks: 1, overdue_tasks: 0 },
  ],
};
const TASK = {
  id: "t1",
  lead_id: "l1",
  lead_reference: "AB12CD34",
  lead_service: "seo",
  title: "Изпратете оферта",
  due_on: "2026-11-01",
  state: "open",
  overdue: true,
  assignee: ADMIN,
  created_at: "2026-10-30T10:00:00Z",
  done_at: null,
  revision: 2,
};

afterEach(() => {
  calls.length = 0;
  routes = {};
});

describe("Crm overview", () => {
  it("shows the counts the server sends and nothing that looks like revenue or a rate", async () => {
    routes = { "/api/admin/crm/overview": OVERVIEW, "/api/admin/crm/tasks": { items: [TASK], total: 1, page: 1, page_size: 25 } };
    render(<Crm />);
    const overview = await screen.findByTestId("crm-overview");
    expect(overview.querySelector('[data-card="enquiries_total"]')).toHaveTextContent("12");
    expect(overview.querySelector('[data-card="follow_ups_overdue"]')).toHaveTextContent("2");
    expect(overview.querySelector('[data-card="projects_active"]')).toHaveTextContent("3");
    const owners = within(screen.getByTestId("crm-owners"));
    expect(owners.getByText("Ани Админ")).toBeInTheDocument();
    expect(owners.getByText(t.overview.unassigned)).toBeInTheDocument();
    expect(overview.textContent).not.toMatch(/€|EUR|лв|%|конверси|прогноз|приход/i);
    expect(screen.getByTestId("crm-export")).toHaveAttribute("href", "/api/admin/crm/leads.csv");
    expect(calls.some((c) => c.path === "/api/admin/crm/overview?days=30")).toBe(true);
  });

  it("lists my open follow-ups first and finishes one with the revision it saw", async () => {
    const user = userEvent.setup();
    routes = { "/api/admin/crm/overview": OVERVIEW, "/api/admin/crm/tasks": { items: [TASK], total: 1, page: 1, page_size: 25 }, "/api/admin/tasks/t1": { ...TASK, state: "done" } };
    render(<Crm />);
    const table = await screen.findByTestId("crm-tasks");
    expect(calls.some((c) => c.path.includes("/crm/tasks?") && c.path.includes("assignee=me") && c.path.includes("state=open"))).toBe(true);
    expect(within(table).getByText("AB12CD34").closest("a")).toHaveAttribute("href", "/admin/leads/l1");
    expect(within(table).getByText(t.tasks.overdue)).toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: t.tasks.done }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/tasks/t1")).toBe(true));
    const patch = calls.find((c) => c.path === "/api/admin/tasks/t1")!;
    expect(patch.init?.method).toBe("PATCH");
    expect(JSON.parse(String(patch.init?.body))).toEqual({ expected_revision: 2, state: "done" });
  });
});

describe("LeadCrm", () => {
  const lead = (extra: Record<string, unknown> = {}) => ({
    "/api/admin/crm/admins": [ADMIN, { id: "a2", name: "Борис Админ" }],
    "/api/admin/leads/l1/tasks": [TASK],
    "/api/admin/leads/l1/timeline": [
      { at: "2026-11-02T10:00:00Z", kind: "audit", action: "lead.status_changed", actor: "ani@example.com", detail: null, ref: null },
      { at: "2026-11-01T10:00:00Z", kind: "note", action: "lead.note", actor: "Ани Админ", detail: "Говорих с клиента.", ref: null },
      { at: "2026-10-31T10:00:00Z", kind: "project", action: "project.status.in_progress", actor: null, detail: null, ref: "p1" },
    ],
    "/api/admin/leads/l1/customer": {
      has_account: true,
      account_verified: true,
      projects: [{ id: "p1", reference: "EF56AB78", title: "Бизнес сайт", status: "in_progress" }],
      quotations: [{ id: "q1", status: "accepted", version: 1, published_at: "2026-10-30T10:00:00Z" }],
    },
    ...extra,
  });

  it("shows the customer, the follow-ups and the timeline, translating the recorded actions", async () => {
    routes = lead();
    render(<LeadCrm leadId="l1" ownerId={null} />);
    const customer = await screen.findByTestId("lead-customer");
    expect(customer).toHaveTextContent(`${t.customer.account}: ${t.customer.yes} (${t.customer.verified})`);
    expect(within(customer).getByText("Бизнес сайт").closest("a")).toHaveAttribute("href", "/admin/projects?id=p1");
    expect(within(screen.getByTestId("lead-tasks")).getByText("Изпратете оферта")).toBeInTheDocument();
    const timeline = screen.getByTestId("lead-timeline");
    expect(timeline).toHaveTextContent(t.timeline.actions["lead.status_changed"]);
    expect(timeline).toHaveTextContent("Говорих с клиента.");
    expect(timeline).toHaveTextContent(adminDictionaries.bg.projects.statuses.in_progress);
  });

  it("sets the owner by id, never by name, and adds a follow-up with a date and an assignee", async () => {
    const user = userEvent.setup();
    routes = lead({ "/api/admin/leads/l1/owner": { owner: ADMIN }, "/api/admin/leads/l1/tasks": [TASK] });
    render(<LeadCrm leadId="l1" ownerId={null} />);
    const form = await screen.findByTestId("lead-owner-form");
    await waitFor(() => expect(within(form).getByRole("option", { name: "Ани Админ" })).toBeInTheDocument());
    await user.selectOptions(within(form).getByRole("combobox"), "a1");
    await user.click(within(form).getByRole("button", { name: t.owner.save }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.init?.method === "PUT")!;
    expect(put.path).toBe("/api/admin/leads/l1/owner");
    expect(JSON.parse(String(put.init?.body))).toEqual({ owner_id: "a1" });

    const add = screen.getByTestId("task-form");
    await user.type(within(add).getByLabelText(t.tasks.text), "Позвънете на клиента");
    await user.click(within(add).getByRole("button", { name: t.tasks.save }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/leads/l1/tasks" && c.init?.method === "POST")).toBe(true));
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toEqual({ title: "Позвънете на клиента", due_on: null, assignee_id: null });
  });
});

describe("texts", () => {
  it("have the same keys in both languages and name no money or rate", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, item]) => (item && typeof item === "object" ? keys(item).map((inner) => `${key}.${inner}`) : [key]));
    expect(keys(adminDictionaries.en.crm)).toEqual(keys(adminDictionaries.bg.crm));
    expect(JSON.stringify(adminDictionaries.en.crm.overview.cards)).not.toMatch(/revenue|forecast|rate|conversion/i);
  });
});
