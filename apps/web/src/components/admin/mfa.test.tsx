import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/admin/LoginForm";
import { groupKey, MfaPanel } from "@/components/admin/Mfa";
import { adminDictionaries } from "@/i18n/admin";
import { ApiError } from "@/lib/admin-api";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string, init?: RequestInit) => fetchMock(path, init),
}));

const t = adminDictionaries.bg;
const user = { id: "u1", email: "admin@example.com", full_name: "Админ", role: "admin", last_login_at: null, mfa_enabled: true };
const codes = Array.from({ length: 10 }, (_, i) => `abcd-efgh-jk${String(i).padStart(2, "0")}`.slice(0, 14));
const assign = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, assign } });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  assign.mockReset();
  fetchMock.mockReset();
});

function signIn() {
  fireEvent.change(screen.getByLabelText(t.login.email), { target: { value: "admin@example.com" } });
  fireEvent.change(screen.getByLabelText(t.login.password), { target: { value: "Correct-Password-1" } });
  fireEvent.click(screen.getByRole("button", { name: t.login.submit }));
}

function body(call: unknown[]): unknown {
  return JSON.parse(((call[1] as RequestInit).body as string) ?? "null");
}

describe("admin login with a second factor", () => {
  it("signs in with the password alone when the account has no TOTP", async () => {
    fetchMock.mockResolvedValue({ user: { ...user, mfa_enabled: false }, expires_at: "2026-11-03T18:00:00Z", mfa: null });
    render(<LoginForm next="/admin/leads" />);
    signIn();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin/leads"));
    expect(screen.queryByTestId("mfa-code-step")).not.toBeInTheDocument();
  });

  it("asks for a code after the password and accepts a recovery code too", async () => {
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/login")) return { user, expires_at: "2026-11-03T10:15:00Z", mfa: "verify" };
      const { code } = JSON.parse(init?.body as string);
      if (code === "123456") throw new ApiError(400, "Кодът не е валиден.", {}, "mfa_code_invalid");
      return { user, expires_at: "2026-11-03T18:00:00Z", mfa: null };
    });
    render(<LoginForm next="/admin" />);
    signIn();
    const step = await screen.findByTestId("mfa-code-step");
    expect(assign).not.toHaveBeenCalled();
    expect(within(step).getByText(t.mfa.codeHint)).toBeInTheDocument();
    const field = within(step).getByLabelText(t.mfa.code);
    expect(field).toHaveAttribute("autocomplete", "one-time-code");

    fireEvent.click(within(step).getByRole("button", { name: t.mfa.verify }));
    expect(await within(step).findByRole("alert")).toHaveTextContent(t.mfa.missingCode);

    fireEvent.change(field, { target: { value: "123456" } });
    fireEvent.click(within(step).getByRole("button", { name: t.mfa.verify }));
    expect(await within(step).findByRole("alert")).toHaveTextContent(t.mfa.invalidCode);
    expect(field).toHaveValue("");

    fireEvent.change(field, { target: { value: " abcd-efgh-jkmn " } });
    fireEvent.click(within(step).getByRole("button", { name: t.mfa.verify }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin"));
    const verify = fetchMock.mock.calls.filter(([path]) => path === "/api/admin/auth/mfa/verify");
    expect(verify).toHaveLength(2);
    expect(body(verify[1])).toEqual({ code: "abcd-efgh-jkmn" });
  });

  it("returns to the password step after a lockout and can cancel the pending session", async () => {
    fetchMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/login")) return { user, expires_at: "2026-11-03T10:15:00Z", mfa: "verify" };
      if (path.endsWith("/logout")) return undefined;
      throw new ApiError(429, "Твърде много заявки.", {}, "rate_limited");
    });
    render(<LoginForm />);
    signIn();
    fireEvent.change(await screen.findByLabelText(t.mfa.code), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: t.mfa.verify }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.login.tooMany);
    expect(screen.getByLabelText(t.login.password)).toHaveValue("");

    signIn();
    fireEvent.click(await screen.findByRole("button", { name: t.mfa.cancel }));
    await screen.findByLabelText(t.login.password);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(assign).not.toHaveBeenCalled();
  });

  it("forces enrolment when MFA is required, then shows the recovery codes once", async () => {
    fetchMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/login")) return { user: { ...user, mfa_enabled: false }, expires_at: "2026-11-03T10:15:00Z", mfa: "enrol" };
      if (path.endsWith("/mfa/setup")) return { secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", otpauth_uri: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };
      return { recovery_codes: codes, session: { user, expires_at: "2026-11-03T18:00:00Z", mfa: null } };
    });
    render(<LoginForm next="/admin/catalogue" />);
    signIn();
    expect(await screen.findByText(t.mfa.enrolTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.mfa.start }));
    const key = await screen.findByTestId("mfa-secret");
    expect(key).toHaveTextContent("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    expect(screen.getByRole("link", { name: t.mfa.openApp })).toHaveAttribute("href", expect.stringMatching(/^otpauth:\/\/totp\//));

    fireEvent.change(screen.getByLabelText(t.mfa.code), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: t.mfa.confirm }));
    const list = await screen.findByTestId("mfa-recovery-codes");
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(assign).not.toHaveBeenCalled();
    fireEvent.click(within(list).getByRole("button", { name: t.mfa.codesDone }));
    expect(assign).toHaveBeenCalledWith("/admin/catalogue");
  });
});

describe("account page two-factor panel", () => {
  it("enrols from the account page", async () => {
    let enabled = false;
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/admin/auth/mfa") return { enabled, enabled_at: enabled ? "2026-11-03T09:00:00Z" : null, recovery_codes_remaining: enabled ? 10 : 0, required: false };
      if (path.endsWith("/mfa/setup")) return { secret: "ABCDEFGHIJKLMNOP", otpauth_uri: "otpauth://totp/x" };
      enabled = true;
      return { recovery_codes: codes, session: null };
    });
    render(<MfaPanel />);
    expect(await screen.findByTestId("mfa-status")).toHaveTextContent(t.mfa.statusOff);
    fireEvent.click(screen.getByRole("button", { name: t.mfa.setUp }));
    fireEvent.click(await screen.findByRole("button", { name: t.mfa.start }));
    fireEvent.change(await screen.findByLabelText(t.mfa.code), { target: { value: "111222" } });
    fireEvent.click(screen.getByRole("button", { name: t.mfa.confirm }));
    expect(await screen.findByTestId("mfa-recovery-codes")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(t.mfa.enabled);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/auth/mfa/confirm", expect.objectContaining({ body: JSON.stringify({ code: "111222" }) }));
  });

  it("replaces recovery codes and switches off with password and code", async () => {
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/admin/auth/mfa") return { enabled: true, enabled_at: "2026-11-03T09:00:00Z", recovery_codes_remaining: 7, required: false };
      if (path.endsWith("/recovery-codes")) return { recovery_codes: codes };
      return undefined;
    });
    render(<MfaPanel />);
    expect(await screen.findByText("Оставащи кодове за възстановяване: 7")).toBeInTheDocument();

    const regenerate = screen.getByRole("form", { name: t.mfa.regenerateTitle });
    fireEvent.change(within(regenerate).getByLabelText(t.mfa.code), { target: { value: "123123" } });
    fireEvent.click(within(regenerate).getByRole("button", { name: t.mfa.regenerate }));
    const list = await screen.findByTestId("mfa-recovery-codes");
    fireEvent.click(within(list).getByRole("button", { name: t.mfa.codesDone }));

    const disable = await screen.findByRole("form", { name: t.mfa.disableTitle });
    fireEvent.change(within(disable).getByLabelText(t.mfa.password), { target: { value: "Correct-Password-1" } });
    fireEvent.change(within(disable).getByLabelText(t.mfa.code), { target: { value: "456456" } });
    fireEvent.click(within(disable).getByRole("button", { name: t.mfa.disable }));
    expect(await screen.findByRole("status")).toHaveTextContent(t.mfa.disabled);
    const call = fetchMock.mock.calls.find(([path]) => path === "/api/admin/auth/mfa/disable")!;
    expect(body(call)).toEqual({ password: "Correct-Password-1", code: "456456" });
  });

  it("hides switching off when MFA is required", async () => {
    fetchMock.mockResolvedValue({ enabled: true, enabled_at: "2026-11-03T09:00:00Z", recovery_codes_remaining: 10, required: true });
    render(<MfaPanel />);
    expect(await screen.findByTestId("mfa-status")).toHaveTextContent(t.mfa.required);
    expect(screen.queryByRole("form", { name: t.mfa.disableTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: t.mfa.regenerateTitle })).toBeInTheDocument();
  });

  it("groups the key for typing", () => {
    expect(groupKey("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
  });
});
