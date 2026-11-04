import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountForm } from "@/components/account/AccountForms";
import { accountTexts } from "@/i18n/account";
import { customerAccountsEnabled } from "@/lib/account-flag";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const t = accountTexts.bg;
const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/bg/konto/potvardi");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  push.mockReset();
});

describe("customer account pages", () => {
  it("stay off unless the flag is exactly true", () => {
    expect(customerAccountsEnabled()).toBe(false);
    vi.stubEnv("CUSTOMER_ACCOUNTS_ENABLED", "1");
    expect(customerAccountsEnabled()).toBe(false);
    vi.stubEnv("CUSTOMER_ACCOUNTS_ENABLED", "true");
    expect(customerAccountsEnabled()).toBe(true);
  });

  it("takes the token from the fragment, clears the address bar and confirms only on request", async () => {
    window.history.replaceState(null, "", "/bg/konto/potvardi#token=one-time-token-value-123");
    fetchMock.mockReturnValue(reply(204));
    render(<AccountForm view="verify" locale="bg" />);
    const button = await screen.findByRole("button", { name: t.verify.submit });
    expect(window.location.hash).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(await screen.findByText(t.verify.done)).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/accounts/verification/confirm");
    expect(JSON.parse(init.body as string)).toEqual({ token: "one-time-token-value-123" });
  });

  it("explains what to do when the link has no token", async () => {
    render(<AccountForm view="reset" locale="bg" />);
    expect(await screen.findByText(t.reset.noToken)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.reset.submit })).not.toBeInTheDocument();
  });

  it("leaves marketing consent unticked and separate from the privacy notice", async () => {
    fetchMock.mockReturnValue(reply(202, { status: "accepted" }));
    render(<AccountForm view="register" locale="bg" />);
    const marketing = screen.getByLabelText(t.register.marketing) as HTMLInputElement;
    expect(marketing.checked).toBe(false);
    fireEvent.change(screen.getByLabelText(t.email), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText(t.password), { target: { value: "Correct-Horse-2026" } });
    fireEvent.click(document.getElementById("account-privacy") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: t.register.submit }));
    expect(await screen.findByText(t.register.done)).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ privacy_acknowledged: true, marketing_consent: false, locale: "bg" });
    expect(Object.keys(body)).not.toContain("company");
  });

  it("offers a new link only after the server says the e-mail is unconfirmed", async () => {
    fetchMock.mockReturnValue(reply(403, { code: "email_not_verified", detail: "Първо потвърдете имейла си." }));
    render(<AccountForm view="signIn" locale="bg" />);
    fireEvent.change(screen.getByLabelText(t.email), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText(t.password), { target: { value: "Correct-Horse-2026" } });
    fireEvent.click(screen.getByRole("button", { name: t.signIn.submit }));
    expect(await screen.findByText("Първо потвърдете имейла си.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.resend.title })).toBeInTheDocument();
    await waitFor(() => expect(push).not.toHaveBeenCalled());
  });
});
