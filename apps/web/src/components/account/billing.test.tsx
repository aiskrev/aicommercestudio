import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvisorBilling, PaymentResult } from "@/components/account/AdvisorBilling";
import { billingTexts } from "@/i18n/billing";

const t = billingTexts.bg;
const fetchMock = vi.fn();
const assign = vi.fn();
const offer = {
  key: "pro_monthly",
  kind: "subscription",
  plan: "pro",
  interval: "month",
  currency: "eur",
  amount_minor: 2900,
  requires_scope: false,
};

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function server(subscriptions: unknown[] = [], offers: unknown[] = [offer]) {
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/offers")) return reply(offers);
    if (url.endsWith("/status")) return reply({ subscriptions, has_customer: subscriptions.length > 0 });
    return reply({ url: "https://checkout.stripe.test/cs_1" });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", { configurable: true, value: { assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  assign.mockReset();
});

describe("billing on the page", () => {
  it("disappears while billing is off", async () => {
    fetchMock.mockImplementation(() => reply({ code: "not_found", detail: "Not found." }, 404));
    const { container } = render(<AdvisorBilling locale="bg" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("sends only the offer key and goes to Stripe's page", async () => {
    server();
    render(<AdvisorBilling locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: t.buy }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.test/cs_1"));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/checkout")) as [string, RequestInit];
    expect(JSON.parse(call[1].body as string)).toEqual({ offer: "pro_monthly", locale: "bg" });
  });

  it("names no payment method", async () => {
    server();
    render(<AdvisorBilling locale="bg" />);
    await screen.findByRole("button", { name: t.buy });
    expect(document.body.textContent).not.toMatch(/PayPal|Apple Pay|Google Pay|Visa/);
  });

  it("offers management, not a second purchase, to a subscriber", async () => {
    server([{ offer: "pro_monthly", status: "active", cancel_at_period_end: false, current_period_end: null, action_required: false }]);
    render(<AdvisorBilling locale="bg" />);
    expect(await screen.findByRole("button", { name: t.manage })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.buy })).not.toBeInTheDocument();
  });

  it("asks for confirmation when a payment needs it", async () => {
    server([{ offer: "pro_monthly", status: "incomplete", cancel_at_period_end: false, current_period_end: null, action_required: true }]);
    render(<AdvisorBilling locale="bg" />);
    expect(await screen.findByText(t.actionRequired)).toBeInTheDocument();
  });

  it("does not say a payment succeeded until the server confirms it", async () => {
    server([]);
    render(<PaymentResult locale="bg" />);
    expect(await screen.findByText(t.processing)).toBeInTheDocument();
    expect(screen.queryByText(t.confirmed)).not.toBeInTheDocument();
  });
});
