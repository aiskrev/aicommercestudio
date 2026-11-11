import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountHome } from "@/components/account/AccountHome";
import { QuoteRequests } from "@/components/account/QuoteRequests";
import { accountTexts } from "@/i18n/account";
import { locales } from "@/i18n/config";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/account/DataRights", () => ({ DataRights: () => null }));

const fetchMock = vi.fn();
const t = accountTexts.bg;

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const PROFILE = {
  email: "customer@example.com",
  display_name: null,
  locale: "bg",
  marketing_consent: false,
  email_verified: true,
  created_at: "2026-11-01T09:00:00Z",
  privacy_notice_version: "2026-11-10.1",
  status: "active",
};

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("QuoteRequests", () => {
  it("lists only what the server returns: reference, date, kind and a quotation state, never contact details or links", async () => {
    fetchMock.mockImplementation(() =>
      reply(200, [
        { reference: "AB12CD34", created_at: "2026-11-05T10:00:00Z", kind: "basket", service: "business_websites", quotation_status: "published" },
        { reference: "EF56AB78", created_at: "2026-11-03T10:00:00Z", kind: "contact", service: "seo", quotation_status: null },
      ]),
    );
    render(<QuoteRequests locale="bg" />);
    const section = await screen.findByTestId("account-quote-requests");
    const rows = await within(section).findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("AB12CD34");
    expect(rows[0]).toHaveTextContent(t.quotes.kinds.basket);
    expect(rows[0]).toHaveTextContent(t.quotes.quotation.published);
    expect(rows[1]).not.toHaveTextContent(t.quotes.quotation.published);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/accounts/quote-requests");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(section.textContent).not.toMatch(/@|https?:|token/i);
  });

  it("says so when there is nothing, and when the list cannot be loaded", async () => {
    fetchMock.mockImplementation(() => reply(200, []));
    const first = render(<QuoteRequests locale="bg" />);
    expect(await screen.findByText(t.quotes.empty)).toBeInTheDocument();
    first.unmount();
    fetchMock.mockImplementation(() => reply(500, { code: "error" }));
    render(<QuoteRequests locale="bg" />);
    expect(await screen.findByText(t.quotes.failed)).toBeInTheDocument();
  });

  it("has texts in both languages for every kind and every quotation state", () => {
    for (const locale of locales) {
      const texts = accountTexts[locale].quotes;
      expect(Object.keys(texts.kinds)).toEqual(["contact", "quote", "configurator", "basket", "tool"]);
      expect(Object.keys(texts.quotation)).toEqual(["published", "accepted", "declined", "withdrawn", "expired"]);
      expect(JSON.stringify(texts)).not.toMatch(/€/);
    }
  });
});

describe("AccountHome status", () => {
  const home = (profile: object) =>
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/me")) return reply(200, profile);
      if (url.endsWith("/sessions")) return reply(200, []);
      return reply(200, []);
    });

  it("shows the account status read from the server, and a pending deletion request", async () => {
    home(PROFILE);
    const first = render(<AccountHome locale="bg" />);
    const status = await screen.findByTestId("account-status");
    expect(status).toHaveTextContent(t.home.statusActive);
    expect(status).toHaveTextContent(t.home.verified);
    expect(status).toHaveTextContent("2026-11-10.1");
    first.unmount();
    home({ ...PROFILE, status: "deletion_requested" });
    render(<AccountHome locale="bg" />);
    await waitFor(() => expect(screen.getByTestId("account-status")).toHaveTextContent(t.home.statusDeletion));
    // The status is only displayed: the profile form sends no status field.
    expect(screen.getByTestId("account-quote-requests")).toBeInTheDocument();
  });
});
