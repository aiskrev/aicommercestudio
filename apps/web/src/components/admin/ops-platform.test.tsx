import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Operations } from "@/components/admin/Operations";
import { adminDictionaries } from "@/i18n/admin";
import { ApiError } from "@/lib/admin-api";
import type { OpsOrganization, OpsOverview } from "@/lib/admin-types";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string, init?: RequestInit) => fetchMock(path, init),
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/operations",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const t = adminDictionaries.en.opsPlatform;
const bg = adminDictionaries.bg.opsPlatform;
const ORG = "00000000-0000-4000-8000-00000000000a";
const BASE = `/api/ops/organizations/${ORG}`;
const org: OpsOrganization = { id: ORG, slug: "a", name: "Org A", status: "active", data_region: "eu", is_demo: false, role: "viewer" };
const READ = ["org.read", "workspaces.read", "agents.read", "registry.read", "evals.read", "observability.read", "incidents.read", "changes.read"];
const agent = { id: "agent-1", workspace_id: "ws-1", key: "support", name: "Support", status: "active", provider: null, model: null, version: null, purpose: null, created_at: "", updated_at: "" };

function serve(permissions: string[], modules: string[], extra: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async (path: string) => {
    if (path === "/api/ops/organizations") return [org];
    if (path === BASE) {
      const overview: OpsOverview = { organization: org, role: "viewer", permissions, workspaces: 1, agents_by_status: { active: 1 }, telemetry: { connected: false, note: "" }, modules: modules as OpsOverview["modules"] };
      return overview;
    }
    if (path === `${BASE}/agents`) return [agent];
    if (path === `${BASE}/workspaces`) return [];
    if (path in extra) {
      const value = extra[path];
      if (value instanceof Error) throw value;
      return value;
    }
    throw new Error(`unexpected ${path}`);
  });
}

afterEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("AI operations platform tabs", () => {
  it("shows only tabs for modules that are switched on and readable by the role", async () => {
    serve(READ, ["registry", "incidents"]);
    render(<Operations />);
    const tabs = await screen.findByTestId("ops-tabs");
    await waitFor(() => expect(within(tabs).getAllByRole("tab")).toHaveLength(3));
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      adminDictionaries.bg.opsPlatform.tabs.overview,
      adminDictionaries.bg.opsPlatform.tabs.registry,
      adminDictionaries.bg.opsPlatform.tabs.incidents,
    ]);
    await userEvent.setup().click(within(tabs).getByRole("tab", { name: bg.tabs.registry }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("tab=registry"));
  });

  it("observability says it is not live and names its sources", async () => {
    window.history.replaceState(null, "", "/?tab=observability");
    const freshness = { live: false, sources: { synthetic: 3 }, latest_record_at: "2026-11-03T10:00:00Z", note: "" };
    const group = { key: "total", label: "total", runs: 3, succeeded: 2, failed: 1, error_rate_percent: 33.33, avg_duration_ms: 900, error_categories: { timeout: 1 }, input_tokens: 300, output_tokens: 90, estimated_cost: { EUR: "0.0100" }, missing_rate_runs: 1 };
    serve(READ, ["observability"], {
      [`${BASE}/observability/summary?days=30&group_by=agent`]: { period_days: 30, period_start: "", group_by: "agent", groups: [{ ...group, key: "a", label: "Support" }], totals: group, freshness },
      [`${BASE}/observability/evaluation`]: { budgets: [], rules: [], freshness, note: "" },
      [`${BASE}/rate-cards`]: [],
    });
    render(<Operations />);
    const banner = await screen.findByTestId("ops-freshness");
    expect(banner).toHaveTextContent(bg.observability.notLive);
    expect(banner).toHaveTextContent(`${bg.observability.sourceNames.synthetic} 3`);
    expect(screen.getByText(bg.observability.noRateCards)).toBeInTheDocument();
    expect(screen.getAllByText(/0\.0100 EUR/).length).toBeGreaterThan(0);
    // A viewer has no import form.
    expect(screen.queryByTestId("ops-import-json")).not.toBeInTheDocument();
  });

  it("the client access tab says the portal is off when the API answers 404", async () => {
    window.history.replaceState(null, "", "/?tab=clients");
    serve([...READ, "portal_users.read", "portal_users.write"], [], {
      [`${BASE}/portal-users`]: new ApiError(404, "Not found.", {}, "not_found"),
    });
    render(<Operations />);
    expect(await screen.findByTestId("ops-portal-disabled")).toHaveTextContent(bg.clients.disabled);
  });

  it("incident transitions are offered only as the API allows and send the expected version", async () => {
    window.history.replaceState(null, "", "/?tab=incidents");
    const incident = { id: "i1", number: 1, agent_id: null, title: "Slow answers", severity: "sev3", impact: "internal", status: "detected", client_summary: null, owner_user_id: null, detected_at: "", resolved_at: null, reviewed_at: null, lock_version: 4, updated_at: "2026-11-03T10:00:00Z", allowed_transitions: ["triaged"] };
    serve([...READ, "incidents.write"], ["incidents"], {
      [`${BASE}/incidents`]: [incident],
      [`${BASE}/incidents/i1`]: { ...incident, events: [] },
      [`${BASE}/incidents/i1/transition`]: { ...incident, status: "triaged" },
    });
    const user = userEvent.setup();
    render(<Operations />);
    await user.click(await screen.findByRole("button", { name: /Slow answers/ }));
    const detail = await screen.findByTestId("ops-incident-detail");
    const move = within(detail).getByRole("button", { name: `${bg.incidents.move}: ${bg.incidents.statuses.triaged}` });
    expect(within(detail).queryByRole("button", { name: new RegExp(bg.incidents.statuses.resolved) })).not.toBeInTheDocument();
    await user.click(move);
    const call = fetchMock.mock.calls.find(([p]) => p === `${BASE}/incidents/i1/transition`)!;
    expect(JSON.parse(String(call[1].body))).toMatchObject({ to: "triaged", expected_version: 4 });
  });
});

describe("ops platform texts", () => {
  it("say what is simulated and never claim live data or round-the-clock cover", () => {
    for (const dict of [t, bg]) {
      expect(dict.common.simulatedHint).toMatch(/model|модел/);
      const all = JSON.stringify(dict);
      expect(all).not.toMatch(/24\/7|SLA|uptime|real-time|в реално време/i);
    }
  });
});
