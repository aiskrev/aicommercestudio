import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Compliance } from "@/components/admin/Compliance";
import { adminDictionaries } from "@/i18n/admin";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string, init?: RequestInit) => fetchMock(path, init),
}));

const t = adminDictionaries.bg.compliance;

const withdrawal = {
  id: "w1",
  reference: "W-20261110-ABC123",
  offer: "pro_monthly",
  status: "received",
  eligibility: "within_period",
  customer_kind: "consumer",
  early_start_requested: true,
  contract_concluded_at: "2026-11-09T10:00:00Z",
  period_ends_at: "2026-11-23T10:00:00Z",
  created_at: "2026-11-10T08:00:00Z",
  decided_at: null,
  outcome_note: null,
  refund_reference: null,
  refund_amount_minor: null,
};
const withdrawalDetail = {
  ...withdrawal,
  statement: "Отказвам се от договора.",
  locale: "bg",
  account_email: "client@example.com",
  audit: [{ at: "2026-11-10T08:00:00Z", action: "billing.withdrawal_received", by: "account:1" }],
};
const dataRow = {
  id: "d1",
  reference: "D-20261110-XYZ789",
  kind: "deletion",
  status: "open",
  created_at: "2026-11-10T09:00:00Z",
  handled_at: null,
  outcome_note: null,
  deadline: {
    state: "overdue",
    received_at: "2026-09-01T09:00:00Z",
    base_due_at: "2026-10-01T09:00:00Z",
    extended_due_at: null,
    effective_due_at: "2026-10-01T09:00:00Z",
    extension_reason: null,
    extension_notified_at: null,
    completed_at: null,
  },
};
const dataDetail = {
  ...dataRow,
  message: null,
  handled_by: null,
  account_email: "client@example.com",
  deletion_blockers: ["subscription_active"],
  stripe_attestation_required: true,
  audit: [],
};

function serve(overrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") return overrides.post ?? {};
    if (path.startsWith("/api/admin/compliance/withdrawals/")) return withdrawalDetail;
    if (path.startsWith("/api/admin/compliance/withdrawals")) return [withdrawal];
    if (path.startsWith("/api/admin/compliance/data-requests/")) return overrides.dataDetail ?? dataDetail;
    if (path.startsWith("/api/admin/compliance/data-requests")) return [dataRow];
    return [];
  });
}

afterEach(() => fetchMock.mockReset());

describe("staff queues for legal requests", () => {
  it("lists withdrawals without the statement or the e-mail, and filters by status", async () => {
    serve();
    const user = userEvent.setup();
    render(<Compliance />);
    const table = await screen.findByTestId("withdrawal-list");
    expect(within(table).getByText(withdrawal.reference)).toBeInTheDocument();
    expect(table.textContent).not.toContain("client@example.com");
    expect(table.textContent).not.toContain("Отказвам се");
    await user.selectOptions(screen.getByLabelText(t.filterStatus), "refunded");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/compliance/withdrawals?status=refunded", undefined));
  });

  it("shows the details and the audit trail and records a decision, never a refund of its own", async () => {
    serve();
    const user = userEvent.setup();
    render(<Compliance />);
    await user.click(await screen.findByRole("button", { name: `${t.open} ${withdrawal.reference}` }));
    const detail = await screen.findByTestId("withdrawal-detail");
    expect(within(detail).getByText("Отказвам се от договора.")).toBeInTheDocument();
    expect(within(detail).getByText("client@example.com")).toBeInTheDocument();
    expect(within(await screen.findByTestId("audit-trail")).getByText(/billing.withdrawal_received/)).toBeInTheDocument();
    expect(screen.getByText(t.decideNote)).toBeInTheDocument(); // refunds are made by hand in Stripe
    await user.selectOptions(document.querySelector("select#decision") as HTMLSelectElement, "refunded");
    await user.type(screen.getByLabelText(t.refundRef), "re_123");
    await user.type(screen.getByLabelText(t.refundAmount), "2900");
    await user.click(screen.getByRole("button", { name: t.decide }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post?.[0]).toBe("/api/admin/compliance/withdrawals/w1/decide");
      expect(JSON.parse(post?.[1].body)).toMatchObject({ status: "refunded", refund_reference: "re_123", refund_amount_minor: 2900 });
    });
    expect(await screen.findByText(t.saved)).toBeInTheDocument();
  });

  it("lists data requests by type and keeps deletion blocked while the billing state is not final", async () => {
    serve();
    const user = userEvent.setup();
    render(<Compliance />);
    await user.click(screen.getByRole("tab", { name: t.tabs.data }));
    const table = await screen.findByTestId("data-request-list");
    expect(table.textContent).not.toContain("client@example.com");
    await user.click(within(table).getByRole("button", { name: `${t.open} ${dataRow.reference}` }));
    const blockers = await screen.findByTestId("deletion-blockers");
    expect(within(blockers).getByText(t.blockerLabels.subscription_active)).toBeInTheDocument();
    await user.click(screen.getByLabelText(t.deleteConfirm));
    expect(screen.getByRole("button", { name: t.handleDelete })).toBeDisabled();
  });

  it("asks staff to confirm they checked Stripe, and allows executing only when nothing blocks", async () => {
    serve({ dataDetail: { ...dataDetail, deletion_blockers: [] } });
    const user = userEvent.setup();
    render(<Compliance />);
    await user.click(screen.getByRole("tab", { name: t.tabs.data }));
    await user.click(await screen.findByRole("button", { name: `${t.open} ${dataRow.reference}` }));
    await screen.findByText(t.noBlockers);
    await user.click(screen.getByLabelText(new RegExp(t.stripeChecked)));
    await user.click(screen.getByLabelText(t.deleteConfirm));
    await user.click(screen.getByRole("button", { name: t.handleDelete }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(JSON.parse(post?.[1].body)).toMatchObject({ action: "execute_deletion", stripe_checked: true });
    });
  });

  it("shows the working due date, flags an overdue request and records an extension only on a staff decision", async () => {
    serve();
    const user = userEvent.setup();
    render(<Compliance />);
    await user.click(screen.getByRole("tab", { name: t.tabs.data }));
    const table = await screen.findByTestId("data-request-list");
    expect(within(table).getByTestId("deadline-badge")).toHaveTextContent(t.deadlineStates.overdue);
    await user.click(within(table).getByRole("button", { name: `${t.open} ${dataRow.reference}` }));
    const panel = await screen.findByTestId("request-deadline");
    expect(panel).toHaveTextContent(t.dueNote);
    expect(fetchMock.mock.calls.some(([path, init]) => String(path).endsWith("/extend") && init?.method === "POST")).toBe(false);
    await user.selectOptions(screen.getByLabelText(t.extendMonths), "2");
    await user.type(screen.getByLabelText(t.extensionReason), "Сложно искане, засяга няколко системи.");
    await user.click(screen.getByRole("button", { name: t.extend }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([path, init]) => String(path).endsWith("/extend") && init?.method === "POST");
      expect(JSON.parse(post?.[1].body)).toEqual({ months: 2, reason: "Сложно искане, засяга няколко системи.", notified: false });
    });
  });

  it("speaks English to English-speaking staff", () => {
    expect(adminDictionaries.en.compliance.decideNote).toMatch(/Stripe/);
    expect(Object.keys(adminDictionaries.en.compliance.blockerLabels).sort()).toEqual(Object.keys(t.blockerLabels).sort());
  });
});
