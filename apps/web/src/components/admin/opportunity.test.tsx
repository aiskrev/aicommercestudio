import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpportunityPanel, ProposalsPanel } from "@/components/admin/Opportunity";
import { adminDictionaries } from "@/i18n/admin";
import { ApiError } from "@/lib/admin-api";
import { contentToText, type Opportunity, type Proposal, type ProposalContent, textToContent } from "@/lib/opportunity-types";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string, init?: RequestInit) => fetchMock(path, init),
}));

const t = adminDictionaries.bg;

const opportunity: Opportunity = {
  exists: false,
  lead_id: "lead-1",
  source: {
    source: "website_contact_form",
    inquiry_type: "contact",
    submitted_service: "integrations",
    workshop_key: "kubernetes_review",
    linked: [{ kind: "assessment_result", reference: "AB12CD34", detail: "cloud_maturity", created_at: "2026-11-01T10:00:00Z" }],
  },
  service_domain: null,
  problem_summary: null,
  scope_summary: null,
  discovery_status: "not_started",
  qualification_status: "unassessed",
  qualification_rationale: null,
  technical_constraints: null,
  stakeholders: [],
  next_action: null,
  next_action_due: null,
  notes: null,
  recommended_workshop: "kubernetes_review",
  recommended_assessment: null,
  recommendation_rationale: null,
  revision: 0,
  updated_at: null,
  updated_by: null,
};

const content: ProposalContent = {
  scope: "Преглед на клъстерите.",
  deliverables: ["Доклад"],
  assumptions: ["Достъп само за четене"],
  exclusions: ["Промени по клъстерите"],
  dependencies: [],
  responsibilities: [{ party: "client", item: "Осигурява достъп" }],
  acceptance_criteria: ["Клиентът приема доклада"],
  milestones: [{ title: "Преглед", description: "RBAC и мрежа", indicative_timing: "уточнява се" }],
  risks: [{ risk: "Липса на достъп", mitigation: "Ранно уточняване" }],
  commercial: { pricing_basis: "[ПОПЪЛВА СЕ ОТ ЧОВЕК]", payment_terms: "", validity: "", notes: "" },
};

const proposal: Proposal = {
  id: "p1",
  lead_id: "lead-1",
  kind: "sow",
  title: "SOW за преглед",
  status: "in_review",
  current_version: 1,
  revision: 2,
  created_by: "Админ",
  decided_by: null,
  decision_note: null,
  approved_version: null,
  approved_at: null,
  created_at: "2026-11-02T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
  versions: [{ number: 1, origin: "generated_draft", change_note: null, author: "Админ", created_at: "2026-11-02T10:00:00Z", changed_sections: ["scope"] }],
  latest: {
    number: 1,
    origin: "generated_draft",
    change_note: null,
    author: "Админ",
    created_at: "2026-11-02T10:00:00Z",
    changed_sections: ["scope"],
    content,
    findings: [{ code: "commercial_placeholder", section: "commercial", blocking: true }],
  },
};

afterEach(() => {
  fetchMock.mockReset();
});

describe("opportunity panel", () => {
  it("shows the source, the workshop enquiry and linked records, and saves with the revision", async () => {
    fetchMock.mockImplementation(async (_path: string, init?: RequestInit) =>
      init?.method === "PUT" ? { ...opportunity, exists: true, revision: 1, updated_by: "Админ" } : opportunity,
    );
    render(<OpportunityPanel leadId="lead-1" />);
    const source = await screen.findByTestId("opportunity-source");
    expect(source).toHaveTextContent("Запитване за: Преглед на Kubernetes платформата");
    expect(source).toHaveTextContent("Запазен резултат от оценка · #AB12CD34 · cloud_maturity");
    expect(screen.getByLabelText(t.opportunity.recommendedWorkshop)).toHaveValue("kubernetes_review");

    fireEvent.change(screen.getByLabelText(t.opportunity.qualification), { target: { value: "qualified" } });
    fireEvent.change(screen.getByLabelText(t.opportunity.rationale), { target: { value: "Ясен собственик" } });
    fireEvent.click(screen.getByRole("button", { name: t.opportunity.addStakeholder }));
    fireEvent.change(screen.getByLabelText(t.opportunity.stakeholderName), { target: { value: "Мария" } });
    fireEvent.change(screen.getByLabelText(t.opportunity.stakeholderRole), { target: { value: "Операции" } });
    fireEvent.click(screen.getByLabelText(t.opportunity.stakeholdersConfirmed));
    fireEvent.click(screen.getByRole("button", { name: t.opportunity.save }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/leads/lead-1/opportunity", expect.objectContaining({ method: "PUT" })));
    const body = JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")![1].body);
    expect(body).toMatchObject({
      expected_revision: 0,
      qualification_status: "qualified",
      qualification_rationale: "Ясен собственик",
      stakeholders: [{ name: "Мария", role: "Операции", provided_in: "call" }],
      stakeholders_confirmed: true,
      recommended_workshop: "kubernetes_review",
      service_domain: null,
    });
  });

  it("offers a reload when someone else saved first", async () => {
    fetchMock.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") throw new ApiError(409, "Променено от друг.", {}, "opportunity_stale");
      return opportunity;
    });
    render(<OpportunityPanel leadId="lead-1" />);
    fireEvent.click(await screen.findByRole("button", { name: t.opportunity.save }));
    expect(await screen.findByText("Променено от друг.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.opportunity.reload })).toBeInTheDocument();
  });
});

describe("proposals panel", () => {
  it("lists drafts, shows blocking findings and offers only the allowed decisions", async () => {
    fetchMock.mockImplementation(async () => [proposal]);
    render(<ProposalsPanel leadId="lead-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /SOW за преглед/ }));
    const findings = screen.getByTestId("proposal-findings");
    expect(findings).toHaveTextContent(t.proposals.findingCodes.commercial_placeholder);
    expect(findings).toHaveTextContent(t.proposals.blocking);
    for (const action of ["approve", "reject", "reopen", "withdraw"] as const) {
      expect(screen.getByRole("button", { name: t.proposals.actions[action] })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: t.proposals.actions.submit })).toBeNull();
    // In review the sections are read-only; a new version needs a draft.
    expect(screen.queryByRole("button", { name: t.proposals.saveVersion })).toBeNull();
    expect(screen.getByTestId("proposal-history")).toHaveTextContent(t.proposals.origins.generated_draft);
  });

  it("generates a first draft and sends a decision with the revision", async () => {
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "POST" && path.endsWith("/transition")) return { ...proposal, status: "rejected", revision: 3 };
      if (init?.method === "POST") return { ...proposal, status: "draft", revision: 1 };
      return [proposal];
    });
    render(<ProposalsPanel leadId="lead-1" />);
    fireEvent.change(await screen.findByLabelText(t.proposals.newTitle), { target: { value: "Оферта" } });
    fireEvent.click(screen.getByRole("button", { name: t.proposals.generate }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/leads/lead-1/proposals",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ kind: "proposal", title: "Оферта", generate: true }) }),
      ),
    );
    const card = (await screen.findAllByTestId("proposal"))[0];
    if (!within(card).queryByTestId("proposal-findings")) fireEvent.click(within(card).getByRole("button", { name: /SOW за преглед/ }));
    fireEvent.change(screen.getByLabelText(t.proposals.decisionNote), { target: { value: "Попълнете цената" } });
    fireEvent.click(screen.getByRole("button", { name: t.proposals.actions.reject }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([path]) => String(path).endsWith("/transition"));
      expect(JSON.parse(call![1].body)).toEqual({ expected_revision: 2, action: "reject", note: "Попълнете цената", acknowledge_warnings: false });
    });
  });
});

describe("section text round trip", () => {
  it("turns the editable text back into the same content", () => {
    expect(textToContent(contentToText(content), content.commercial)).toEqual(content);
  });
});
