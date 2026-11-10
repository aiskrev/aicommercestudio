import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketingWithdrawal } from "@/components/marketing/MarketingWithdrawal";
import { marketingTexts } from "@/i18n/marketing";

const fetchMock = vi.fn();
const TOKEN = "a".repeat(64);

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  window.history.replaceState(null, "", "/");
});

function open(hash: string) {
  window.history.replaceState(null, "", `/bg/otkaz-ot-marketing${hash}`);
}

describe("self-service withdrawal of marketing consent", () => {
  it.each(["bg", "en"] as const)("asks for one click, sends only the token and the language, and confirms (%s)", async (locale) => {
    const t = marketingTexts[locale];
    open(`#token=${TOKEN}`);
    fetchMock.mockImplementation(() => reply({ status: "withdrawn" }));
    render(<MarketingWithdrawal locale={locale} />);
    const button = await screen.findByRole("button", { name: t.confirm });
    expect(fetchMock).not.toHaveBeenCalled(); // opening the link alone changes nothing
    expect(window.location.hash).toBe(""); // the token left the address bar
    fireEvent.click(button);
    expect(await screen.findByText(t.done)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/marketing/withdraw");
    expect(JSON.parse(init.body as string)).toEqual({ token: TOKEN, locale });
    expect(init.body).not.toMatch(/@/); // no e-mail or personal data is sent
  });

  it("says so when the consent was already withdrawn", async () => {
    open(`#token=${TOKEN}`);
    fetchMock.mockImplementation(() => reply({ status: "already_withdrawn" }));
    render(<MarketingWithdrawal locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: marketingTexts.en.confirm }));
    expect(await screen.findByText(marketingTexts.en.alreadyTitle)).toBeInTheDocument();
  });

  it("shows one invalid-link message for a missing or malformed token", async () => {
    render(<MarketingWithdrawal locale="bg" />);
    expect(await screen.findByText(marketingTexts.bg.invalidTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: marketingTexts.bg.confirm })).not.toBeInTheDocument();
  });

  it("treats a refusal from the server as an invalid link", async () => {
    open(`#token=${TOKEN}`);
    fetchMock.mockImplementation(() => reply({ code: "token_invalid" }, 404));
    render(<MarketingWithdrawal locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: marketingTexts.bg.confirm }));
    expect(await screen.findByText(marketingTexts.bg.invalidTitle)).toBeInTheDocument();
  });

  it("keeps the button for a retry after a temporary error or the rate limit", async () => {
    open(`#token=${TOKEN}`);
    fetchMock.mockImplementationOnce(() => reply({}, 500)).mockImplementationOnce(() => reply({}, 429));
    render(<MarketingWithdrawal locale="bg" />);
    fireEvent.click(await screen.findByRole("button", { name: marketingTexts.bg.confirm }));
    expect(await screen.findByText(marketingTexts.bg.error)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: marketingTexts.bg.confirm })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: marketingTexts.bg.confirm }));
    expect(await screen.findByText(marketingTexts.bg.tooMany)).toBeInTheDocument();
  });

  it("has the same texts in both languages", () => {
    expect(Object.keys(marketingTexts.bg).sort()).toEqual(Object.keys(marketingTexts.en).sort());
  });
});
