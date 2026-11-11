import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuotationView } from "@/components/quotation/QuotationView";
import { getContent } from "@/content";
import { locales, localizePath } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { type QuotationView as View, tokenFromFragment } from "@/lib/quotation";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const t = getContent("bg").quotation;
const TOKEN = "k".repeat(43);

const VIEW: View = {
  reference: "AB12CD34",
  status: "published",
  kind: "proposal",
  title: "Оферта за нов сайт",
  company: "Пример ООД",
  locale: "bg",
  published_at: "2026-11-11T10:00:00Z",
  valid_until: null,
  version: 3,
  open: true,
  decision: null,
  content: {
    scope: "Нов бизнес сайт с форма за запитване.",
    deliverables: ["Работещ сайт", "Документация"],
    assumptions: ["Съдържанието идва от клиента."],
    exclusions: ["Онлайн магазин."],
    dependencies: [],
    responsibilities: [{ party: "client", item: "Определя отговорник." }],
    acceptance_criteria: ["Приемателен списък."],
    milestones: [{ title: "Структура", description: "Прототип", indicative_timing: "уточнява се" }],
    risks: [{ risk: "Закъснение на съдържанието", mitigation: "Ранно съгласуване" }],
    commercial: { pricing_basis: "Фиксирана цена за описания обхват.", payment_terms: "", validity: "", notes: "" },
  },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();
let handler: (path: string, body: Record<string, unknown>) => Response;

beforeEach(() => {
  window.history.replaceState(null, "", `/bg/oferta#t=${TOKEN}`);
  handler = (path) => (path === "view" ? jsonResponse(200, VIEW) : jsonResponse(404, {}));
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => handler(url.replace("/api/public/quotations/", ""), JSON.parse(init.body as string)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const mount = () => render(<QuotationView locale="bg" texts={t} contactHref="/bg/kontakti" />);

describe("tokenFromFragment", () => {
  it("reads only a well-formed secret from the fragment", () => {
    expect(tokenFromFragment(`#t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromFragment(`t=${TOKEN}&x=1`)).toBe(TOKEN);
    for (const bad of ["", "#", "#t=", "#t=short", `#x=${TOKEN}`, `#t=${TOKEN}'; DROP`, `#t=${"a".repeat(101)}`]) expect(tokenFromFragment(bad)).toBeNull();
  });
});

describe("QuotationView", () => {
  it("asks the API with the secret in the body, never in the URL, and shows the approved version", async () => {
    mount();
    const quotation = await screen.findByTestId("quotation");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/public/quotations/view");
    expect(url).not.toContain(TOKEN);
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN });
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(within(quotation).getByRole("heading", { level: 2, name: VIEW.title })).toBeInTheDocument();
    expect(within(quotation).getByTestId("quotation-reference")).toHaveTextContent("AB12CD34");
    expect(within(quotation).getByTestId("quotation-status")).toHaveTextContent(t.status.published);
    const content = within(quotation).getByTestId("quotation-content");
    expect(content).toHaveTextContent("Нов бизнес сайт с форма за запитване.");
    expect(content).toHaveTextContent("Работещ сайт");
    expect(content).toHaveTextContent("Определя отговорник.");
    expect(content).toHaveTextContent("Фиксирана цена за описания обхват.");
    // Empty sections are left out; nothing is added that the approved version does not hold.
    expect(content.querySelector('[data-section="dependencies"]')).toBeNull();
    expect(within(quotation).queryByTestId("quotation-valid-until")).not.toBeInTheDocument();
    expect(window.sessionStorage.length + window.localStorage.length).toBe(0); // nothing is stored in the browser
  });

  it("shows 'not found' without calling the API when the link has no secret, and when the API does not know it", async () => {
    window.history.replaceState(null, "", "/bg/oferta");
    const first = mount();
    expect(await screen.findByTestId("quotation-not-found")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    first.unmount();
    window.history.replaceState(null, "", `/bg/oferta#t=${TOKEN}`);
    handler = () => jsonResponse(404, { code: "quotation_not_found" });
    mount();
    expect(await screen.findByTestId("quotation-not-found")).toHaveTextContent(t.notFound.title);
    expect(screen.getByRole("link", { name: t.notFound.contact })).toHaveAttribute("href", "/bg/kontakti");
  });

  it("follows a new link pasted into the same tab (only the fragment changes) and forgets the old answer form", async () => {
    mount();
    await screen.findByTestId("quotation");
    const other = "m".repeat(43);
    handler = () => jsonResponse(404, { code: "quotation_not_found" });
    window.history.replaceState(null, "", `/bg/oferta#t=${other}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(await screen.findByTestId("quotation-not-found")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ token: other });
    expect(screen.queryByTestId("quotation")).not.toBeInTheDocument();
  });

  it("validates the answer before sending: a name and the confirmation are required", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("quotation-answer");
    await user.click(screen.getByRole("button", { name: t.answer.accept }));
    expect(screen.getByText(t.answer.required)).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(t.answer.name))).toHaveAttribute("aria-invalid", "true");
    await user.type(screen.getByLabelText(new RegExp(t.answer.name)), "Мария Иванова");
    await user.click(screen.getByRole("button", { name: t.answer.accept }));
    expect(screen.getByText(t.answer.confirm)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/decision"))).toHaveLength(0);
  });

  it("sends one explicit answer with the name and shows what was recorded", async () => {
    handler = (path, body) =>
      path === "view"
        ? jsonResponse(200, VIEW)
        : jsonResponse(200, { ...VIEW, status: "accepted", open: false, decision: { decided_at: "2026-11-12T09:00:00Z", name: body.name } });
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("quotation-answer");
    await user.type(screen.getByLabelText(new RegExp(t.answer.name)), "Мария Иванова");
    await user.type(screen.getByLabelText(/Бележка/), "Моля, обадете ни се в понеделник.");
    await user.click(screen.getByRole("checkbox", { name: /Потвърждавам/ }));
    await user.dblClick(screen.getByRole("button", { name: t.answer.accept }));
    await waitFor(() => expect(screen.getByTestId("quotation-decided")).toHaveTextContent("Мария Иванова"));
    const sent = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/decision"));
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0][1].body)).toEqual({ token: TOKEN, decision: "accept", name: "Мария Иванова", note: "Моля, обадете ни се в понеделник.", confirmed: true });
    expect(screen.getByTestId("quotation")).toHaveAttribute("data-status", "accepted");
    expect(screen.queryByTestId("quotation-answer")).not.toBeInTheDocument(); // answered once
  });

  it("can decline, and says so when the quotation can no longer be answered", async () => {
    handler = (path) => (path === "view" ? jsonResponse(200, VIEW) : jsonResponse(409, { code: "quotation_closed" }));
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("quotation-answer");
    await user.type(screen.getByLabelText(new RegExp(t.answer.name)), "Мария Иванова");
    await user.click(screen.getByRole("checkbox", { name: /Потвърждавам/ }));
    await user.click(screen.getByRole("button", { name: t.answer.decline }));
    expect(await screen.findByText(t.answer.closed)).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).decision).toBe("decline");
  });

  it("shows a withdrawn quotation without content and without an answer form", async () => {
    handler = () => jsonResponse(200, { ...VIEW, status: "withdrawn", open: false, content: null });
    mount();
    const quotation = await screen.findByTestId("quotation");
    expect(quotation).toHaveAttribute("data-status", "withdrawn");
    expect(within(quotation).getByText(t.withdrawn)).toBeInTheDocument();
    expect(within(quotation).queryByTestId("quotation-content")).not.toBeInTheDocument();
    expect(within(quotation).queryByTestId("quotation-answer")).not.toBeInTheDocument();
  });

  it("shows the validity date only when the quotation has one, and an expired one cannot be answered", async () => {
    handler = () => jsonResponse(200, { ...VIEW, status: "expired", open: false, valid_until: "2026-11-01" });
    mount();
    expect(await screen.findByTestId("quotation-valid-until")).toHaveTextContent("2026-11-01");
    expect(screen.getByText(t.expired)).toBeInTheDocument();
    expect(screen.queryByTestId("quotation-answer")).not.toBeInTheDocument();
  });
});

describe("quotation texts", () => {
  it("are complete in both languages, write no amount, and say the answer does not replace a written agreement", () => {
    for (const locale of locales) {
      const texts = getContent(locale).quotation;
      expect(Object.keys(texts.status)).toEqual(["published", "accepted", "declined", "withdrawn", "expired"]);
      expect(JSON.stringify(texts)).not.toMatch(/€|\bEUR\b|\bлв\b/); // a limit of characters is not an amount
      expect(texts.answer.statement).toMatch(locale === "bg" ? /не замества писмен договор/ : /does not replace a written agreement/);
      expect(texts.answer.nothingSent.length).toBeGreaterThan(10);
    }
    expect(localizePath("bg", routes.quotation)).toBe("/bg/oferta");
    expect(localizePath("en", routes.quotation)).toBe("/en/quotation");
  });
});
