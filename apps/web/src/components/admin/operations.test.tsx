import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Operations } from "@/components/admin/Operations";
import { adminDictionaries } from "@/i18n/admin";
import type { OpsAgent, OpsOrganization, OpsOverview } from "@/lib/admin-types";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string) => fetchMock(path),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/operations",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const t = adminDictionaries.bg.operations;
const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";

function org(id: string, overrides: Partial<OpsOrganization> = {}): OpsOrganization {
  return { id, slug: id.slice(-1), name: `Org ${id.slice(-1)}`, status: "active", data_region: "eu", is_demo: false, role: "viewer", ...overrides };
}

const agent: OpsAgent = {
  id: "agent-1",
  workspace_id: "ws-1",
  key: "support-assistant",
  name: "Support assistant",
  status: "active",
  provider: "anthropic",
  model: "claude-opus-5-5",
  version: "v1.2",
  purpose: null,
  created_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
};

function serve(orgs: OpsOrganization[], permissions: string[]) {
  fetchMock.mockImplementation(async (path: string) => {
    if (path === "/api/ops/organizations") return orgs;
    const id = path.split("/")[4];
    const base = `/api/ops/organizations/${id}`;
    const selected = orgs.find((o) => o.id === id)!;
    if (path === base) {
      const overview: OpsOverview = {
        organization: selected,
        role: selected.role,
        permissions,
        workspaces: 1,
        agents_by_status: { active: 1 },
        telemetry: { connected: false, note: "" },
      };
      return overview;
    }
    if (path === `${base}/agents`) return [agent];
    if (path === `${base}/workspaces`) return [{ id: "ws-1", slug: "production", name: "Production", environment: "production", created_at: "" }];
    if (path === `${base}/members`) return [{ id: "m1", user_id: "u1", email: "owner@example.com", full_name: "Owner", role: "owner", created_at: "" }];
    throw new Error(`unexpected ${path}`);
  });
}

afterEach(() => {
  fetchMock.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("AI operations scaffold page", () => {
  it("explains that access is by membership when the user has no organisation", async () => {
    serve([], []);
    render(<Operations />);
    expect(await screen.findByText(t.noOrganizations)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows registry data only, says telemetry is not connected and labels demo data", async () => {
    serve([org(ORG_A, { is_demo: true })], ["agents.read", "org.read", "workspaces.read"]);
    render(<Operations />);
    const table = await screen.findByTestId("ops-agents");
    expect(within(table).getByText("Support assistant")).toBeInTheDocument();
    expect(within(table).getByText("Production")).toBeInTheDocument();
    expect(screen.getByText(t.scaffoldNotice)).toBeInTheDocument();
    expect(screen.getByTestId("ops-demo-notice")).toHaveTextContent(t.demoNotice);
    expect(screen.getByText(t.telemetryOff)).toBeInTheDocument();
    // A viewer has no members.read permission: the members panel is absent and never requested.
    expect(screen.queryByTestId("ops-members")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([p]) => p)).not.toContain(`/api/ops/organizations/${ORG_A}/members`);
  });

  it("requests data only for the selected organisation and shows members to admins", async () => {
    window.history.replaceState(null, "", `/?org=${ORG_B}`);
    serve([org(ORG_A), org(ORG_B, { role: "admin" })], ["agents.read", "members.read", "org.read", "workspaces.read"]);
    render(<Operations />);
    expect(await screen.findByTestId("ops-members")).toHaveTextContent("owner@example.com");
    await waitFor(() => expect(screen.getByTestId("ops-agents")).toBeInTheDocument());
    const scoped = fetchMock.mock.calls.map(([p]) => p as string).filter((p) => p !== "/api/ops/organizations");
    expect(scoped.length).toBeGreaterThan(0);
    for (const path of scoped) expect(path.startsWith(`/api/ops/organizations/${ORG_B}`)).toBe(true);
    expect(screen.queryByTestId("ops-demo-notice")).not.toBeInTheDocument();
  });
});
