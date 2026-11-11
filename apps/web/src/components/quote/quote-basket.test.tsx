import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type BasketNames, QuoteBasket } from "@/components/quote/QuoteBasket";
import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { CONFIGURATOR_MODEL_VERSION } from "@/lib/configurator";
import { PRICE_GROUPS } from "@/lib/price-schedule";
import { addExtra, BASKET_TOKEN_KEY, type BasketView, fetchBasket, saveConfiguration, submitBasket } from "@/lib/quote-basket";
import { routes } from "@/lib/routes";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const content = getContent("bg");
const t = content.quoteBasket;
const dict = getDictionary("bg");
const TOKEN = "t".repeat(43);
const ITEM = "11111111-1111-4111-8111-111111111111";
const EXTRA = "22222222-2222-4222-8222-222222222222";

const names: BasketNames = {
  packages: { business_website: "Бизнес сайт" },
  offers: {
    service: [
      { key: "seo", name: "SEO" },
      { key: "audit", name: "Одит" },
    ],
    care_plan: [{ key: "website", name: "Website Care" }],
    ai_managed: [{ key: "essential", name: "Essential" }],
    workshop: [{ key: "ai_strategy_discovery", name: "AI стратегия" }],
  },
};

function view(patch: Partial<BasketView> = {}): BasketView {
  return {
    status: "open",
    version: 3,
    expires_at: "2026-12-11T10:00:00Z",
    locale: "bg",
    model_version: CONFIGURATOR_MODEL_VERSION,
    schedule_version: "2026-11-10.1",
    currency: "EUR",
    owner_approval: "pending",
    tax_treatment: "not_vat_registered",
    binding: false,
    max_items: 8,
    items: [
      {
        id: ITEM,
        kind: "configuration",
        needs_update: false,
        answers: { project_type: "business_website" },
        review: {
          model_version: CONFIGURATOR_MODEL_VERSION,
          schedule_version: "2026-11-10.1",
          currency: "EUR",
          owner_approval: "pending",
          tax_treatment: "not_vat_registered",
          binding: false,
          package: "business_website",
          service: "business_websites",
          delivery: "fixed_scope",
          items: [
            { kind: "package", key: "business_website", reason: "business_website", band: { unit: "project", from: 810, typical: [1350, 2250] } },
            { kind: "service", key: "seo", reason: "feature:seo", band: { unit: "month", from: 180, typical: [270, 450] } },
          ],
          included: [],
          unpriced: ["feature:blog"],
          assumptions: ["written_scope_before_start"],
          exclusions: ["hosting"],
          totals: { one_time_from: 810, monthly_from: 180, primary_priced: true },
          human_review: { required: true, reasons: ["indicative_only", "unpriced_requirements"] },
        },
        extra: null,
      },
      { id: EXTRA, kind: "extra", needs_update: false, answers: null, review: null, extra: { group: "care_plan", key: "website", band: { unit: "month", from: 80, typical: [160, 320] } } },
    ],
    totals: { one_time_from: 810, monthly_from: 260, priced_lines: 3, unpriced_lines: 1 },
    unpriced: [{ item_id: ITEM, key: "feature:blog" }],
    assumptions: ["written_scope_before_start"],
    exclusions: ["hosting", "licences"],
    human_review: { required: true, reasons: ["indicative_only", "unpriced_requirements"] },
    reference: null,
    ...patch,
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Handler = (url: string, init?: RequestInit) => Response | undefined;
const fetchMock = vi.fn();
let handler: Handler;

beforeEach(() => {
  window.localStorage.clear();
  handler = () => undefined;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/public/form-token") return jsonResponse(200, { token: "tok-1" });
    return handler(url, init) ?? jsonResponse(404, { code: "not_found" });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const calls = (method: string, path: string) => fetchMock.mock.calls.filter(([url, init]) => url === `/api/public/quote-basket${path}` && (init?.method ?? "GET") === method);

function mount() {
  return render(
    <QuoteBasket
      locale="bg"
      texts={t}
      results={content.configurator.review}
      fields={{ goals: content.configurator.questions.goals, special: content.configurator.questions.special }}
      featureLabels={content.configurator.questions.features.options}
      form={dict.form}
      validation={dict.validation}
      names={names}
      privacyHref="/bg/poveritelnost"
      configuratorHref="/bg/konfigurator"
      packagesHref="/bg/proektni-paketi"
    />,
  );
}

describe("quote basket client (lib/quote-basket.ts)", () => {
  it("has no basket without a token and asks the server for nothing", async () => {
    expect(await fetchBasket()).toEqual({ ok: false, kind: "none" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a basket for the first item, keeps only the token and sends it in a header", async () => {
    handler = (url, init) => (url === "/api/public/quote-basket" && init?.method === "POST" ? jsonResponse(201, { token: TOKEN, basket: view({ version: 2 }) }) : undefined);
    const result = await addExtra("service", "seo", "bg");
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(BASKET_TOKEN_KEY)).toBe(TOKEN);
    expect(Object.keys(window.localStorage)).toEqual([BASKET_TOKEN_KEY]); // nothing else is stored in the browser
    const body = JSON.parse(calls("POST", "")[0][1].body as string);
    expect(body).toEqual({ locale: "bg", item: { kind: "extra", group: "service", key: "seo" } });

    handler = (url) => (url === "/api/public/quote-basket" ? jsonResponse(200, view()) : undefined);
    await fetchBasket();
    const [url, init] = calls("GET", "")[0];
    expect(url).not.toContain(TOKEN); // never in a URL
    expect((init.headers as Record<string, string>)["X-Basket-Token"]).toBe(TOKEN);
  });

  it("sends answers and keys only, with the version it saw, and retries once after a concurrent change", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    let version = 3;
    let attempts = 0;
    handler = (url, init) => {
      if (url === "/api/public/quote-basket" && !init?.method) return jsonResponse(200, view({ version }));
      if (url === "/api/public/quote-basket" && init?.method === "GET") return jsonResponse(200, view({ version }));
      if (url === `/api/public/quote-basket/items/${ITEM}` && init?.method === "PUT") {
        attempts += 1;
        if (attempts === 1) {
          version = 4; // another tab changed the basket in between
          return jsonResponse(409, { code: "basket_changed" });
        }
        return jsonResponse(200, view({ version: 5 }));
      }
      return undefined;
    };
    const answers = { project_type: "business_website", features: ["seo"] } as never;
    const result = await saveConfiguration(answers, "bg", ITEM);
    expect(result.ok && result.basket.version).toBe(5);
    const bodies = calls("PUT", `/items/${ITEM}`).map(([, init]) => JSON.parse(init.body as string));
    expect(bodies.map((body) => body.expected_version)).toEqual([3, 4]);
    expect(bodies[0].item).toEqual({ kind: "configuration", model_version: CONFIGURATOR_MODEL_VERSION, answers });
    expect(JSON.stringify(bodies)).not.toMatch(/price|amount|total|band|€/);
  });

  it("forgets the token when the basket is unknown or expired, and after sending", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    handler = () => jsonResponse(404, { code: "basket_not_found" });
    expect(await fetchBasket()).toEqual({ ok: false, kind: "none" });
    expect(window.localStorage.getItem(BASKET_TOKEN_KEY)).toBeNull();

    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    handler = (url) => (url === "/api/public/quote-basket/submit" ? jsonResponse(201, { reference: "AB12CD34" }) : undefined);
    const contact = { name: "A B", email: "a@example.com", company: "C", phone: "", goals: "", special_requirements: "", privacy_acknowledged: true, marketing_consent: false, website: "" };
    expect(await submitBasket(contact, 3, "tok-1", "bg")).toEqual({ ok: true, reference: "AB12CD34" });
    expect(window.localStorage.getItem(BASKET_TOKEN_KEY)).toBeNull();
    const sent = JSON.parse(calls("POST", "/submit")[0][1].body as string);
    expect(sent).toMatchObject({ expected_version: 3, locale: "bg", form_token: "tok-1", email: "a@example.com" });
  });

  it("offers as extras exactly the groups of the price schedule, and has a localized, unindexed page", () => {
    expect(Object.keys(t.extras.groups).sort()).toEqual(Object.keys(PRICE_GROUPS).sort());
    expect(Object.keys(getContent("en").quoteBasket.extras.groups).sort()).toEqual(Object.keys(PRICE_GROUPS).sort());
    expect(localizePath("bg", routes.quoteBasket)).toBe("/bg/zayavka");
    expect(localizePath("en", routes.quoteBasket)).toBe("/en/quote-request");
    for (const locale of ["bg", "en"] as const) {
      const texts = getContent(locale).quoteBasket;
      expect(`${texts.lead} ${texts.notice}`).toMatch(locale === "bg" ? /не е поръчка|не са оферта/ : /not an order|not a quote/);
      expect(JSON.stringify(texts)).not.toMatch(/€|\d{3,}/); // no amount is written into the texts
    }
  });
});

describe("QuoteBasket", () => {
  it("shows the empty state with ways to start when there is no basket", async () => {
    mount();
    const empty = await screen.findByTestId("basket-empty");
    expect(within(empty).getByRole("link", { name: t.empty.configure })).toHaveAttribute("href", "/bg/konfigurator");
    expect(within(empty).getByRole("link", { name: t.empty.packages })).toHaveAttribute("href", "/bg/proektni-paketi");
    expect(screen.queryByTestId("basket-send")).not.toBeInTheDocument();
    expect(screen.getByText(t.notice)).toBeInTheDocument();
  });

  it("shows what the server computed: lines, one-time and monthly apart, unpriced, exclusions and reasons", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    handler = (url) => (url === "/api/public/quote-basket" ? jsonResponse(200, view()) : undefined);
    mount();
    const items = await screen.findByTestId("basket-items");
    expect(within(items).getAllByRole("listitem").filter((node) => node.hasAttribute("data-item"))).toHaveLength(2);
    expect(within(items).getByText("Бизнес сайт", { selector: "p.font-semibold" })).toBeInTheDocument();
    expect(within(items).getByText(/от 810\s€$/)).toBeInTheDocument();
    expect(within(items).getByText(/от 80\s€ на месец/)).toBeInTheDocument();
    const totals = screen.getByTestId("basket-totals");
    expect(totals.querySelector('[data-total="one-time"]')).toHaveTextContent(/^810\s€$/);
    expect(totals.querySelector('[data-total="monthly"]')).toHaveTextContent(/^260\s€ на месец$/);
    expect(screen.getByTestId("basket-unpriced-count")).toHaveTextContent("1");
    expect(screen.getByTestId("basket-unpriced")).toHaveTextContent("Блог");
    expect(screen.getByTestId("basket-exclusions")).toHaveTextContent(content.configurator.review.exclusionLabels.licences);
    expect(screen.getByTestId("basket-reasons")).toHaveTextContent(content.configurator.review.reasonLabels.indicative_only);
    expect(within(items).getByRole("link", { name: t.items.editLabel.replace("{name}", "Бизнес сайт") })).toHaveAttribute("href", `/bg/konfigurator?item=${ITEM}`);
    // Already chosen extras cannot be added twice.
    expect(screen.getByRole("option", { name: "Website Care" })).toBeDisabled();
  });

  it("removes an item with the version it saw and shows the server's new state", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    handler = (url, init) => {
      if (url === "/api/public/quote-basket") return jsonResponse(200, view());
      if (url === `/api/public/quote-basket/items/${EXTRA}?expected_version=3` && init?.method === "DELETE") {
        return jsonResponse(200, view({ version: 4, items: view().items.slice(0, 1), totals: { one_time_from: 810, monthly_from: 180, priced_lines: 2, unpriced_lines: 1 } }));
      }
      return undefined;
    };
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("basket-items");
    await user.click(screen.getByRole("button", { name: t.items.removeLabel.replace("{name}", "Website Care") }));
    await waitFor(() => expect(screen.getByTestId("basket-totals").querySelector('[data-total="monthly"]')).toHaveTextContent(/^180\s€ на месец$/));
    expect(screen.getByTestId("quote-basket")).toHaveAttribute("data-version", "4");
  });

  it("adds an extra, and after a change in another tab shows the current state and says so", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    let stale = true;
    handler = (url, init) => {
      if (url === "/api/public/quote-basket") return jsonResponse(200, view({ version: stale ? 3 : 9 }));
      if (url === "/api/public/quote-basket/items" && init?.method === "POST") return jsonResponse(409, { code: "basket_changed" });
      return undefined;
    };
    const user = userEvent.setup();
    mount();
    await screen.findByTestId("basket-items");
    await user.selectOptions(screen.getByLabelText(t.extras.label), "service:audit");
    stale = false;
    await user.click(screen.getByRole("button", { name: t.extras.add }));
    expect(await screen.findByText(t.errors.changed)).toBeInTheDocument();
    expect(screen.getByTestId("quote-basket")).toHaveAttribute("data-version", "9");
    const body = JSON.parse(calls("POST", "/items")[0][1].body as string);
    expect(body.item).toEqual({ kind: "extra", group: "service", key: "audit" });
  });

  it("sends the request once, shows the reference and forgets the draft", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    handler = (url, init) => {
      if (url === "/api/public/quote-basket/submit" && init?.method === "POST") return jsonResponse(201, { status: "received", reference: "AB12CD34", message: "ok" });
      if (url === "/api/public/quote-basket") return jsonResponse(200, view());
      return undefined;
    };
    const user = userEvent.setup();
    mount();
    const form = await screen.findByTestId("basket-quote-form");
    await user.click(within(form).getByRole("button", { name: dict.form.submit }));
    expect(within(form).getByText(dict.validation.privacy)).toBeInTheDocument();
    expect(calls("POST", "/submit")).toHaveLength(0);
    await user.type(within(form).getByLabelText(/Име и фамилия/), "Тест Потребител");
    await user.type(within(form).getByLabelText(/Фирма/), "Пример ООД");
    await user.type(within(form).getByLabelText(/Имейл/), "test@example.com");
    await user.click(within(form).getByRole("checkbox", { name: /Запознах се с/ }));
    await user.dblClick(within(form).getByRole("button", { name: dict.form.submit }));
    await waitFor(() => expect(screen.getByTestId("basket-quote-form-sent")).toHaveTextContent("AB12CD34"));
    expect(calls("POST", "/submit")).toHaveLength(1);
    expect(JSON.parse(calls("POST", "/submit")[0][1].body as string)).toMatchObject({ expected_version: 3, privacy_acknowledged: true, marketing_consent: false });
    expect(window.localStorage.getItem(BASKET_TOKEN_KEY)).toBeNull();
    expect(screen.queryByTestId("basket-items")).not.toBeInTheDocument();
  });

  it("marks an item that must be updated and says so", async () => {
    window.localStorage.setItem(BASKET_TOKEN_KEY, TOKEN);
    const stale = view();
    stale.items[0] = { ...stale.items[0], needs_update: true, review: null };
    handler = (url) => (url === "/api/public/quote-basket" ? jsonResponse(200, stale) : undefined);
    mount();
    expect(await screen.findByText(t.items.needsUpdate)).toBeInTheDocument();
  });
});
