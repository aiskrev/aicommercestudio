import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/admin/LoginForm";
import { groupKey, MfaEnrolment, MfaPanel } from "@/components/admin/Mfa";
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
    expect(screen.getByRole("img", { name: t.mfa.qrLabel })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(t.mfa.code), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: t.mfa.confirm }));
    const list = await screen.findByTestId("mfa-recovery-codes");
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(assign).not.toHaveBeenCalled();
    fireEvent.click(within(list).getByRole("button", { name: t.mfa.codesDone }));
    expect(assign).toHaveBeenCalledWith("/admin/catalogue");
  });
});

describe("adding the key to an authenticator app", () => {
  const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  const uri = `otpauth://totp/A.I.%20Commerce%20Studio%20Admin%3Aadmin%40example.com?secret=${secret}&issuer=A.I.%20Commerce%20Studio%20Admin&digits=6&period=30`;
  const writeText = vi.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
    writeText.mockReset();
  });

  async function showKey(setup: { secret: string; otpauth_uri: string } = { secret, otpauth_uri: uri }) {
    fetchMock.mockResolvedValue(setup);
    const view = render(<MfaEnrolment onConfirmed={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: t.mfa.start }));
    await screen.findByTestId("mfa-secret");
    return view;
  }

  const modules = (view: { container: HTMLElement }) => view.container.querySelector("svg[data-testid='mfa-qr'] path")?.getAttribute("d");

  it("draws the QR code inline, with no image request and with a white background of its own", async () => {
    const view = await showKey();
    const qr = screen.getByRole("img", { name: t.mfa.qrLabel });
    expect(qr.tagName.toLowerCase()).toBe("svg");
    expect(view.container.querySelector("img, iframe, object, embed, image, use")).toBeNull();
    expect(qr.querySelector("rect")).toHaveAttribute("fill", "#fff");
    expect(qr.querySelector("path")).toHaveAttribute("fill", "#000");
    expect(modules(view)).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
    expect(qr.outerHTML).not.toContain(secret);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the set-up call; drawing the code asks nothing of anyone
  });

  it("leaves the quiet zone empty and encodes the URI it was given", async () => {
    const view = await showKey();
    const qr = screen.getByRole("img", { name: t.mfa.qrLabel });
    const size = Number(qr.getAttribute("viewBox")?.split(" ")[2]);
    const first = modules(view) ?? "";
    const dark = [...first.matchAll(/M(\d+) (\d+)/g)].flatMap(([, x, y]) => [Number(x), Number(y)]);
    expect(Math.min(...dark)).toBe(4);
    expect(Math.max(...dark)).toBe(size - 5);
    view.unmount();

    const other = await showKey({ secret, otpauth_uri: uri.replace(secret, "ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP") });
    expect(modules(other)).not.toBe(first);
  });

  it("copies the key without spaces and does not submit the form", async () => {
    writeText.mockResolvedValue(undefined);
    await showKey();
    expect(screen.getByTestId("mfa-secret")).toHaveTextContent("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    fireEvent.click(screen.getByRole("button", { name: t.mfa.copyKey }));
    expect(await screen.findByRole("button", { name: t.mfa.copied })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(secret);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says so when the browser refuses the copy, and the key stays usable", async () => {
    writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await showKey();
    fireEvent.click(screen.getByRole("button", { name: t.mfa.copyKey }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.mfa.copyKeyFailed);
    expect(screen.getByRole("button", { name: t.mfa.copyKey })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.mfa.openApp })).toHaveAttribute("href", uri);
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
