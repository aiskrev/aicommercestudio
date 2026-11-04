import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvisorWorkspace } from "@/components/account/AdvisorWorkspace";
import { workspaceTexts } from "@/i18n/workspace";
import { advisorWorkspaceEnabled } from "@/lib/account-flag";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const t = workspaceTexts.bg;
const fetchMock = vi.fn();

function answer(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("Advisor Workspace", () => {
  it("needs both flags", () => {
    vi.stubEnv("ADVISOR_WORKSPACE_ENABLED", "true");
    expect(advisorWorkspaceEnabled()).toBe(false);
    vi.stubEnv("CUSTOMER_ACCOUNTS_ENABLED", "true");
    expect(advisorWorkspaceEnabled()).toBe(true);
  });

  it("shows the plan and usage the API reports", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/me")
        ? answer({ plan: "pro", features: [], limits: { limit_ai_runs_month: 30 }, usage: {} })
        : answer([]),
    );
    render(<AdvisorWorkspace locale="bg" />);
    expect(await screen.findByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(t.noProjects)).toBeInTheDocument();
  });

  describe("inside a project", () => {
    const version = (number: number) => ({
      number,
      label: null,
      result_kind: "template",
      model: "mock",
      preview: `Преглед ${number}`,
      complexity: "low",
      locked: false,
      disclaimer: "",
    });

    function server(features: string[]) {
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith("/me")) return answer({ plan: "pro", features, limits: {}, usage: {} });
        if (url.endsWith("/projects")) return answer([{ id: "p1", name: "Магазин" }]);
        if (url.includes("/compare")) {
          return answer({
            complexity: { left: "low", right: "medium" },
            sections: { risks: { left_count: 1, right_count: 3 } },
          });
        }
        if (init?.method === "POST") return answer(version(3));
        return answer([version(1), version(2)]);
      });
    }

    async function openProject() {
      fireEvent.click(await screen.findByRole("button", { name: "Магазин" }));
      await screen.findByText("Преглед 2");
    }

    it("hides the controls a plan lacks", async () => {
      server([]);
      render(<AdvisorWorkspace locale="bg" />);
      await openProject();
      expect(screen.queryByRole("button", { name: t.compare })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: t.followUpSubmit })).not.toBeInTheDocument();
    });

    it("compares two versions through the API", async () => {
      server(["compare"]);
      render(<AdvisorWorkspace locale="bg" />);
      await openProject();
      fireEvent.click(screen.getByRole("button", { name: t.compare }));
      const table = await screen.findByTestId("workspace-comparison");
      expect(within(table).getByText(t.sections.risks)).toBeInTheDocument();
      expect(within(table).getByText("3")).toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("compare?left=1&right=2"))).toBe(true);
    });

    it("sends a follow-up on the latest version with its own idempotency key", async () => {
      server(["follow_ups"]);
      render(<AdvisorWorkspace locale="bg" />);
      await openProject();
      fireEvent.change(screen.getByLabelText(t.clarification), { target: { value: "Имаме и втори склад." } });
      fireEvent.click(screen.getByRole("button", { name: t.followUpSubmit }));
      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true),
      );
      const [, init] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "POST") as [
        string,
        RequestInit,
      ];
      expect(JSON.parse(init.body as string)).toMatchObject({ parent_number: 2, clarification: "Имаме и втори склад." });
      expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
    });
  });

  it("uses different words for a template and a real model", () => {
    expect(t.templateResult).not.toBe(t.aiResult);
    expect(workspaceTexts.en.templateResult).not.toBe(workspaceTexts.en.aiResult);
  });
});
