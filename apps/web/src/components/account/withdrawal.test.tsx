import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Withdrawal } from "@/components/account/Withdrawal";
import { billingTexts } from "@/i18n/billing";

const bg = billingTexts.bg;
const en = billingTexts.en;
const fetchMock = vi.fn();

const contract = {
  ref: "sub_1",
  offer: "pro_monthly",
  kind: "subscription",
  customer_kind: "consumer",
  concluded_at: "2026-11-10T10:00:00Z",
  period_ends_at: "2026-11-24T10:00:00Z",
  eligibility: "within_period",
  early_start_requested: false,
  existing_reference: null,
};

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function server(options: { contracts?: unknown[]; requests?: unknown[]; post?: () => Promise<Response> } = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith("/contracts")) return reply(options.contracts ?? [contract]);
    if (url.endsWith("/withdrawals") && init?.method === "POST") {
      return options.post ? options.post() : reply({ reference: "W-AB12CD", created: true }, 201);
    }
    if (url.endsWith("/withdrawals")) return reply(options.requests ?? []);
    return reply({}, 404);
  });
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("withdrawal from the contract", () => {
  it("is a separate action from managing or cancelling the subscription", async () => {
    server();
    render(<Withdrawal locale="bg" />);
    expect(await screen.findByRole("button", { name: "Откажете се от договора тук" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: bg.manage })).not.toBeInTheDocument();
  });

  it("uses the English label in English", async () => {
    server();
    render(<Withdrawal locale="en" />);
    expect(await screen.findByRole("button", { name: "Withdraw from contract here" })).toBeInTheDocument();
    expect(en.withdrawal.action).toBe("Withdraw from contract here");
  });

  it("records nothing until the second step is confirmed", async () => {
    server();
    render(<Withdrawal locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: bg.withdrawal.action }));
    expect(screen.getByText(bg.withdrawal.eligibility.within_period)).toBeInTheDocument();
    expect(screen.getByText(bg.withdrawal.reviewNote)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: bg.withdrawal.continue }));
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: bg.withdrawal.confirm }));
    expect(await screen.findByTestId("withdrawal-reference")).toHaveTextContent("W-AB12CD");
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(post[1].body as string)).toMatchObject({ ref: "sub_1", confirmed: true, locale: "bg" });
    expect(screen.getByText(bg.withdrawal.emailNote)).toBeInTheDocument();
  });

  it("does not claim a refund and shows an expired period as a first reading", async () => {
    server({ contracts: [{ ...contract, eligibility: "period_expired" }] });
    render(<Withdrawal locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: bg.withdrawal.action }));
    expect(screen.getByText(bg.withdrawal.eligibility.period_expired)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/възстановен|върнат/i);
  });

  it("requires a statement of at least ten characters", async () => {
    server();
    render(<Withdrawal locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: bg.withdrawal.action }));
    fireEvent.change(screen.getByLabelText(bg.withdrawal.statementLabel), { target: { value: "късо" } });
    expect(screen.getByRole("button", { name: bg.withdrawal.continue })).toBeDisabled();
  });

  it("keeps the statement and shows the error when saving fails", async () => {
    server({ post: () => reply({ code: "error", detail: "Server down." }, 500) });
    render(<Withdrawal locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: bg.withdrawal.action }));
    fireEvent.click(screen.getByRole("button", { name: bg.withdrawal.continue }));
    fireEvent.click(await screen.findByRole("button", { name: bg.withdrawal.confirm }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server down.");
    await waitFor(() => expect(screen.getByRole("button", { name: bg.withdrawal.confirm })).toBeEnabled());
    expect(screen.queryByTestId("withdrawal-reference")).not.toBeInTheDocument();
  });

  it("shows the open request instead of a second button", async () => {
    server({ contracts: [{ ...contract, existing_reference: "W-OPEN01" }] });
    render(<Withdrawal locale="bg" />);
    expect(await screen.findByText(/W-OPEN01/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: bg.withdrawal.action })).not.toBeInTheDocument();
  });

  it("renders nothing when there is nothing to withdraw from", async () => {
    server({ contracts: [] });
    const { container } = render(<Withdrawal locale="bg" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays visible with the retry time and an e-mail alternative when its data is rate-limited", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ code: "rate_limited", detail: "x" }), { status: 429, headers: { "Retry-After": "30" } })),
    );
    render(<Withdrawal locale="bg" />);
    const notice = await screen.findByTestId("withdrawal-unavailable");
    expect(notice).toHaveTextContent("след 30 с");
    expect(notice).toHaveTextContent("@"); // the statement can also be sent by e-mail
    expect(screen.getByRole("heading", { name: bg.withdrawal.title })).toBeInTheDocument();
    server(); // the limit has passed
    fireEvent.click(screen.getByRole("button", { name: bg.withdrawal.retry }));
    expect(await screen.findByRole("button", { name: bg.withdrawal.action })).toBeInTheDocument();
  });

  it("stays visible in English too", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 503 })));
    render(<Withdrawal locale="en" />);
    expect(await screen.findByTestId("withdrawal-unavailable")).toHaveTextContent("The withdrawal function stays available");
  });

  it("is hidden only when billing is switched off (404)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ code: "not_found" }), { status: 404 })));
    const { container } = render(<Withdrawal locale="bg" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
