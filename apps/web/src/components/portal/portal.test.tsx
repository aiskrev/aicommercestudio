import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Portal } from "@/components/portal/Portal";
import { portalBg, portalDictionaries, portalEn } from "@/i18n/portal";

const respond = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("client portal", () => {
  it("shows that the portal is not open when the API answers 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(404, { code: "not_found" })));
    render(<Portal t={portalEn} locale="en" />);
    expect(await screen.findByTestId("portal-unavailable")).toHaveTextContent(portalEn.unavailable);
  });

  it("signs in with password, then the second factor, and shows read-only data with the not-connected note", async () => {
    let verified = false;
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/login")) return respond(200, { mfa_required: true });
        if (url.endsWith("/login/mfa")) {
          verified = true;
          return respond(200, { mfa_required: false });
        }
        if (!verified) return respond(401, { code: url.endsWith("/dashboard") ? "portal_unauthorized" : "x" });
        if (url.endsWith("/dashboard")) return respond(200, { organization: "Tenant A", agents_by_status: { active: 1 }, open_incidents: 0, evaluations: 1, telemetry: { connected: false } });
        if (url.endsWith("/agents")) return respond(200, [{ name: "Support", status: "active", environment: "production", approved_version: 2 }]);
        if (url.endsWith("/evaluations")) return respond(200, [{ agent: "Support", dataset: "Basics", dataset_version: 1, agent_version: 2, passed: 4, total: 4, simulated: true, finished_at: "2026-11-03T10:00:00Z" }]);
        return respond(200, []);
      }),
    );
    const user = userEvent.setup();
    render(<Portal t={portalEn} locale="en" />);
    await user.type(await screen.findByLabelText(portalEn.email), "client@example.com");
    await user.type(screen.getByLabelText(portalEn.password), "Client-Portal-2026");
    await user.click(screen.getByRole("button", { name: portalEn.signIn }));
    await user.type(await screen.findByLabelText(portalEn.code), "123456");
    await user.click(screen.getByRole("button", { name: portalEn.verify }));
    expect(await screen.findByTestId("portal-organization")).toHaveTextContent("Tenant A");
    expect(screen.getByTestId("portal-not-connected")).toHaveTextContent(portalEn.notConnected);
    expect(screen.getByTestId("portal-evaluations")).toHaveTextContent(portalEn.simulated);
    // No request carries an organisation id: the tenant comes from the session cookie.
    await waitFor(() => expect(calls.length).toBeGreaterThan(4));
    expect(calls.every((c) => !/organization/.test(c.url))).toBe(true);
    // The state-changing requests send the CSRF header.
    const mfa = calls.find((c) => c.url.endsWith("/login/mfa"))!;
    expect(new Headers(mfa.init?.headers).has("X-CSRF-Token")).toBe(true);
  });

  it("has the same texts in both languages", () => {
    expect(Object.keys(portalBg).sort()).toEqual(Object.keys(portalEn).sort());
    for (const dict of Object.values(portalDictionaries)) {
      for (const [key, value] of Object.entries(dict)) expect(value, key).toBeTruthy();
    }
    // English texts are English (the language switch is the only exception: it names the other language).
    const english = Object.entries(portalEn).filter(([key]) => key !== "language");
    expect(JSON.stringify(english)).not.toMatch(/[Ѐ-ӿ]/);
  });
});
