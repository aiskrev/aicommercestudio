import { render, screen } from "@testing-library/react";
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

  it("uses different words for a template and a real model", () => {
    expect(t.templateResult).not.toBe(t.aiResult);
    expect(workspaceTexts.en.templateResult).not.toBe(workspaceTexts.en.aiResult);
  });
});
