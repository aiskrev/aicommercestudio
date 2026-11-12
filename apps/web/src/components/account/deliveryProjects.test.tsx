import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeliveryProjects } from "@/components/account/DeliveryProjects";
import { locales } from "@/i18n/config";
import { projectTexts } from "@/i18n/projects";

const replace = vi.fn();
let search = "";
const router = { push: vi.fn(), replace };
vi.mock("next/navigation", () => ({
  // A stable router object, like the real one: a new object on every render would reload the page data in a loop.
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));

const fetchMock = vi.fn();
const t = projectTexts.bg;
const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const ID = "11111111-2222-4333-8444-555555555555";
const SUMMARY = { id: ID, reference: "AB12CD34", title: "Бизнес сайт", status: "awaiting_approval", updated_at: "2026-11-10T10:00:00Z", open_requests: 1 };
const DETAIL = {
  ...SUMMARY,
  summary: "Нов сайт с блог.",
  revision: 3,
  quotation_reference: "Q-1",
  quotation_status: "accepted",
  scope_version: 2,
  scope: { scope: "Сайт с пет страници.", deliverables: ["Пет страници"], assumptions: [], exclusions: ["Копирайтинг"], acceptance_criteria: [] },
  contract_reference: "Д-2026-14",
  invoice_references: ["Ф-1001"],
  maintenance_plan: null,
  maintenance_note: null,
  milestones: [{ id: "m1", position: 0, title: "Дизайн", description: null, indicative_timing: "2 седмици", status: "in_progress" }],
  events: [
    { id: "e1", kind: "status", author: "team", mine: false, body: null, state: null, parent_id: null, meta: { from: "quotation", to: "awaiting_approval" }, created_at: "2026-11-09T10:00:00Z" },
    { id: "e2", kind: "support", author: "client", mine: true, body: "Въпрос за срока", state: "open", parent_id: null, meta: null, created_at: "2026-11-10T09:00:00Z" },
  ],
  allowed_actions: ["approve_scope", "change_request", "support"],
};

beforeEach(() => {
  search = "";
  // The documents panel asks for its own list; documents are off in these tests (404), so the panel stays out of sight.
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    String(url).endsWith("/documents") ? reply(404, { code: "not_found" }) : fetchMock(url, init),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  replace.mockReset();
});

describe("DeliveryProjects list", () => {
  it("lists the projects the server returns, with a link by id only", async () => {
    fetchMock.mockImplementation(() => reply(200, [SUMMARY]));
    render(<DeliveryProjects locale="bg" />);
    const list = await screen.findByTestId("projects-list");
    expect(within(list).getByText("Бизнес сайт").closest("a")).toHaveAttribute("href", `/bg/konto/izrabotka?p=${ID}`);
    expect(list).toHaveTextContent(t.statuses.awaiting_approval);
    expect(list).toHaveTextContent("AB12CD34");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    // Never a workspace id from the page: the server decides whose projects these are.
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toMatch(/workspace/i);
  });

  it("says so when there are no projects, and on a server error", async () => {
    fetchMock.mockImplementation(() => reply(200, []));
    const first = render(<DeliveryProjects locale="bg" />);
    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    first.unmount();
    fetchMock.mockImplementation(() => reply(500, { code: "error" }));
    render(<DeliveryProjects locale="bg" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    fetchMock.mockImplementation(() => reply(401, { code: "not_authenticated", detail: "Sign in" }));
    render(<DeliveryProjects locale="bg" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/bg/konto/vhod"));
  });
});

describe("DeliveryProjects detail", () => {
  beforeEach(() => {
    search = `p=${ID}`;
  });

  it("shows the project, its approved scope, milestones, references and history, without staff identities", async () => {
    fetchMock.mockImplementation(() => reply(200, DETAIL));
    render(<DeliveryProjects locale="bg" />);
    const detail = await screen.findByTestId("project-detail");
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/projects/${ID}`);
    expect(detail).toHaveTextContent("Бизнес сайт");
    expect(detail).toHaveTextContent(t.statusHints.awaiting_approval);
    expect(detail).toHaveTextContent("Сайт с пет страници.");
    expect(detail).toHaveTextContent("Копирайтинг");
    expect(detail).toHaveTextContent("Д-2026-14");
    expect(detail).toHaveTextContent("Ф-1001");
    expect(within(screen.getByTestId("project-milestones")).getByText("Дизайн")).toBeInTheDocument();
    const history = screen.getByTestId("project-history");
    expect(history).toHaveTextContent(`${t.statuses.quotation} → ${t.statuses.awaiting_approval}`);
    expect(history).toHaveTextContent(t.authors.team);
    expect(history).toHaveTextContent(t.authors.mine);
    expect(detail.textContent).not.toMatch(/@/);
  });

  it("offers only the actions the server allows: approval needs the statement, then posts the revision the person saw", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init: RequestInit) =>
      init.method === "POST" ? reply(200, { ...DETAIL, status: "approved", revision: 4, allowed_actions: ["change_request", "support"] }) : reply(200, DETAIL),
    );
    render(<DeliveryProjects locale="bg" />);
    await screen.findByTestId("project-detail");
    expect(screen.queryByRole("button", { name: t.actions.accept_completion })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.actions.request_changes })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.actions.approve_scope }));
    expect(await screen.findByText(t.confirmNeeded)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("checkbox", { name: t.approveStatement }));
    await user.click(screen.getByRole("button", { name: t.actions.approve_scope }));
    await waitFor(() => expect(screen.getByTestId("project-status")).toHaveTextContent(t.statuses.approved));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/projects/${ID}/decision`);
    expect(JSON.parse(init.body)).toEqual({ expected_revision: 3, action: "approve_scope", note: null });
    expect(screen.queryByRole("button", { name: t.actions.approve_scope })).not.toBeInTheDocument();
  });

  it("tells a member without the approver role who approves, and offers no approval", async () => {
    fetchMock.mockImplementation(() => reply(200, { ...DETAIL, allowed_actions: ["change_request", "support"] }));
    render(<DeliveryProjects locale="bg" />);
    await screen.findByTestId("project-detail");
    expect(screen.getByTestId("project-owners-only")).toHaveTextContent(t.onlyOwners);
    expect(screen.queryByRole("button", { name: t.actions.approve_scope })).not.toBeInTheDocument();
  });

  it("asks for a note before changes are requested, and explains a stale project", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init: RequestInit) =>
      init.method === "POST"
        ? reply(409, { code: "project_stale", detail: "stale" })
        : reply(200, { ...DETAIL, status: "client_review", allowed_actions: ["accept_completion", "request_changes", "change_request", "support"] }),
    );
    render(<DeliveryProjects locale="bg" />);
    await screen.findByTestId("project-detail");
    await user.click(screen.getByRole("button", { name: t.actions.request_changes }));
    expect(await screen.findByText(t.noteRequired)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole("textbox", { name: new RegExp(t.note) }), "Сменете цветовете");
    await user.click(screen.getByRole("button", { name: t.actions.request_changes }));
    expect(await screen.findByText(t.stale)).toBeInTheDocument();
  });

  it("sends a support request and shows the refreshed history", async () => {
    const user = userEvent.setup();
    const answered = { ...DETAIL, events: [...DETAIL.events, { id: "e3", kind: "support", author: "client", mine: true, body: "Нов въпрос", state: "open", parent_id: null, meta: null, created_at: "2026-11-10T11:00:00Z" }] };
    fetchMock.mockImplementation((url: string, init: RequestInit) => (init.method === "POST" ? reply(201, answered) : reply(200, DETAIL)));
    render(<DeliveryProjects locale="bg" />);
    await screen.findByTestId("project-detail");
    await user.click(screen.getByRole("button", { name: t.requestSend }));
    expect(await screen.findByText(t.requestTooShort)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: new RegExp(t.requestBody) }), "Нов въпрос");
    await user.click(screen.getByRole("button", { name: t.requestSend }));
    expect(await screen.findByText(t.requestSent)).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ kind: "support", body: "Нов въпрос" });
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/projects/${ID}/requests`);
    expect(within(screen.getByTestId("project-history")).getByText("Нов въпрос")).toBeInTheDocument();
  });

  it("answers a project of another organisation exactly like one that does not exist", async () => {
    fetchMock.mockImplementation(() => reply(404, { code: "project_not_found", detail: "Project not found." }));
    render(<DeliveryProjects locale="bg" />);
    const error = await screen.findByTestId("project-error");
    expect(error).toHaveTextContent(t.notFound);
    expect(screen.queryByTestId("project-detail")).not.toBeInTheDocument();
  });
});

describe("texts", () => {
  it("have the same keys in both languages and a label for every status", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, item]) => (item && typeof item === "object" ? keys(item).map((inner) => `${key}.${inner}`) : [key]));
    expect(keys(projectTexts.en)).toEqual(keys(projectTexts.bg));
    for (const locale of locales) {
      expect(Object.keys(projectTexts[locale].statuses)).toEqual([
        "draft", "quotation", "awaiting_approval", "approved", "in_progress", "client_review", "completed", "maintenance",
      ]);
      // No promise of an outcome, a deadline or a price.
      expect(JSON.stringify(projectTexts[locale])).not.toMatch(/гарантир|guarantee|€|EUR|лв\b/i);
    }
  });
});
