import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvisorBilling, PaymentResult } from "@/components/account/AdvisorBilling";
import { billingTexts } from "@/i18n/billing";
import { company } from "@/lib/company";
import { legalVersion } from "@/lib/legal-versions";

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

function server(subscriptions: unknown[] = [], offers: unknown[] = [offer], contracts: unknown[] = []) {
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/offers")) return reply(offers);
    if (url.endsWith("/status")) return reply({ subscriptions, has_customer: subscriptions.length > 0 });
    if (url.endsWith("/contracts")) return reply(contracts);
    if (url.endsWith("/withdrawals")) return reply([]);
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

  it("keeps the withdrawal function when the plan list is throttled by the shared workspace limit", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/offers") || url.endsWith("/status")) return reply({ code: "rate_limited", detail: "Too many." }, 429);
      if (url.endsWith("/contracts"))
        return reply([{ ref: "sub_1", offer: "pro_monthly", kind: "subscription", customer_kind: "consumer", concluded_at: null, period_ends_at: null, eligibility: "within_period", early_start_requested: false, existing_reference: null }]);
      return reply([]);
    });
    render(<AdvisorBilling locale="bg" />);
    expect(await screen.findByRole("button", { name: t.withdrawal.action })).toBeInTheDocument();
  });

  it("shows an order review first and starts no payment from the list button", async () => {
    server();
    render(<AdvisorBilling locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: t.buy }));
    expect(await screen.findByTestId("order-review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.review.submit })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/checkout"))).toBe(false);
    expect(document.body.textContent).toContain("Pro");
    expect(document.body.textContent).toContain(t.review.recurring.replace("{interval}", t.intervals.month));
  });

  it("refuses to order without a customer kind and accepted terms", async () => {
    server();
    render(<AdvisorBilling locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: t.buy }));
    fireEvent.click(await screen.findByRole("button", { name: t.review.submit }));
    expect(await screen.findByText(t.review.errors.kind)).toBeInTheDocument();
    expect(screen.getByText(t.review.errors.terms)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/checkout"))).toBe(false);
  });

  it("sends the accepted versions and goes to Stripe's page", async () => {
    server();
    render(<AdvisorBilling locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: t.buy }));
    fireEvent.click(await screen.findByLabelText(t.review.consumer));
    fireEvent.click(screen.getByRole("checkbox", { name: /Прочетох и приемам Общите условия и Условията за абонамент и плащане/ }));
    fireEvent.click(screen.getByRole("button", { name: t.review.submit }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.test/cs_1"));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/checkout")) as [string, RequestInit];
    expect(JSON.parse(call[1].body as string)).toEqual({
      offer: "pro_monthly",
      locale: "bg",
      acceptance: {
        terms: legalVersion("terms"),
        subscription_terms: legalVersion("subscription_terms"),
        order_acceptance: legalVersion("order_acceptance"),
        privacy: legalVersion("privacy"),
        customer_kind: "consumer",
        early_start: false,
        early_start_version: null,
      },
    });
  });

  it("offers the early-start request only to consumers, separately and unticked", async () => {
    server();
    render(<AdvisorBilling locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: t.buy }));
    expect(screen.queryByRole("checkbox", { name: t.review.earlyStart })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText(t.review.consumer));
    const early = screen.getByRole("checkbox", { name: t.review.earlyStart }) as HTMLInputElement;
    expect(early.checked).toBe(false);
    fireEvent.click(early);
    fireEvent.click(screen.getByLabelText(t.review.business));
    expect(screen.queryByRole("checkbox", { name: t.review.earlyStart })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Прочетох и приемам/ }));
    fireEvent.click(screen.getByRole("button", { name: t.review.submit }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/checkout")) as [string, RequestInit];
    expect(JSON.parse(call[1].body as string).acceptance).toMatchObject({ customer_kind: "business", early_start: false });
  });

  it("explains a changed version instead of sending the customer to payment", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/offers")) return reply([offer]);
      if (url.endsWith("/status")) return reply({ subscriptions: [], has_customer: false });
      return reply({ code: "terms_version_changed", detail: "The terms have changed." }, 409);
    });
    render(<AdvisorBilling locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: t.buy }));
    fireEvent.click(await screen.findByLabelText(t.review.consumer));
    fireEvent.click(screen.getByRole("checkbox", { name: /Прочетох и приемам/ }));
    fireEvent.click(screen.getByRole("button", { name: t.review.submit }));
    expect(await screen.findByText(t.review.errors.changed)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
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

describe("seller identification in the order review", () => {
  it.each(["bg", "en"] as const)("shows the seller from the central company data, the price, currency and renewal (%s)", async (locale) => {
    const texts = billingTexts[locale];
    server();
    render(<AdvisorBilling locale={locale} />);
    fireEvent.click(await screen.findByRole("button", { name: texts.buy }));
    const seller = await screen.findByTestId("order-seller");
    expect(seller).toHaveTextContent(locale === "bg" ? company.legalNameBg : company.legalNameEn);
    expect(seller).toHaveTextContent(company.uic);
    expect(seller).toHaveTextContent(locale === "bg" ? company.registeredOfficeBg : company.registeredOfficeEn);
    expect(seller).toHaveTextContent(company.phoneDisplay);
    expect(seller).toHaveTextContent(company.contactEmail);
    expect(seller).toHaveTextContent(texts.review.seller.tradeNameValue);
    const review = screen.getByTestId("order-review");
    expect(review).toHaveTextContent(texts.review.currency);
    expect(review).toHaveTextContent(texts.review.recurring.replace("{interval}", texts.intervals.month));
    expect(review).toHaveTextContent(texts.review.taxNote);
    expect(screen.getByRole("link", { name: texts.review.termsLink })).toHaveAttribute("href", expect.stringContaining(locale));
  });

  it("states the excluded third-party costs only for individually scoped offers", async () => {
    server([], [{ ...offer, key: "support_setup", requires_scope: true }]);
    render(<AdvisorBilling locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: billingTexts.en.buy }));
    expect(await screen.findByText(billingTexts.en.review.thirdParty)).toBeInTheDocument();
  });

  it("does not state it for a standard plan", async () => {
    server();
    render(<AdvisorBilling locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: billingTexts.en.buy }));
    await screen.findByTestId("order-review");
    expect(screen.queryByText(billingTexts.en.review.thirdParty)).not.toBeInTheDocument();
  });

  it("has the same seller labels in both languages", () => {
    expect(Object.keys(billingTexts.bg.review.seller).sort()).toEqual(Object.keys(billingTexts.en.review.seller).sort());
  });
});
