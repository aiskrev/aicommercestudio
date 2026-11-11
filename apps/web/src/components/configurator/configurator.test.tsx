import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfiguratorEntry, resetConfiguratorEnabledCache } from "@/components/configurator/ConfiguratorEntry";
import { ProjectConfigurator } from "@/components/configurator/ProjectConfigurator";
import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { CONFIGURATOR_MODEL_VERSION, type ConfiguratorReview } from "@/lib/configurator";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const t = getContent("bg").configurator;
const dict = getDictionary("bg");
const basketTexts = getContent("bg").quoteBasket.configurator;
const names = { packages: { business_website: "Бизнес сайт", landing_page: "Лендинг страница" }, services: { seo: "SEO" }, carePlans: { website: "Website Care" } };

const REVIEW: ConfiguratorReview = {
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
  unpriced: ["feature:blog", "additional_languages"],
  assumptions: ["written_scope_before_start"],
  exclusions: ["hosting"],
  totals: { one_time_from: 810, monthly_from: 180, primary_priced: true },
  human_review: { required: true, reasons: ["indicative_only", "unpriced_requirements"] },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();
let reviewResponse: () => Response;

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/bg/konfigurator");
  reviewResponse = () => jsonResponse(200, REVIEW);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/public/form-token") return jsonResponse(200, { token: "tok-1" });
    if (url === "/api/public/configurator/review") return reviewResponse();
    if (url === "/api/public/configurator/submissions") return jsonResponse(201, { status: "received", reference: "AB12CD34", message: "ok" });
    return jsonResponse(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function mount(basket?: { href: string; texts: typeof basketTexts }) {
  return render(<ProjectConfigurator locale="bg" texts={t} form={dict.form} validation={dict.validation} inquiry={dict.inquiry} names={names} privacyHref="/bg/poveritelnost" basket={basket} />);
}

const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: /^(Напред|Към прегледа)$/ }));

async function fillBusinessWebsite(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Бизнес сайт/ }));
  await next(user);
  await user.click(screen.getByRole("radio", { name: "До 5" }));
  await user.click(screen.getByRole("radio", { name: "Един" }));
  await user.click(screen.getByRole("radio", { name: "Нов проект" }));
  await next(user);
  await user.click(screen.getByRole("checkbox", { name: "SEO" }));
  await next(user);
  await user.click(screen.getByRole("radio", { name: /Да, имаме лого/ }));
  await user.click(screen.getByRole("radio", { name: "Стандартна дизайн система" }));
  await next(user);
  await next(user); // operations are optional
  await user.click(screen.getByRole("radio", { name: "Гъвкаво" }));
  await user.click(screen.getByRole("radio", { name: "Предпочитам да обсъдим" }));
  await next(user);
}

describe("ProjectConfigurator", () => {
  it("does not move on until the required answers of a step are given, and says which", async () => {
    const user = userEvent.setup();
    mount();
    await next(user);
    expect(screen.getByTestId("configurator-step-title")).toHaveTextContent(t.steps.type);
    expect(screen.getAllByRole("alert").map((node) => node.textContent)).toContain(t.errors.required);
    expect(fetchMock).not.toHaveBeenCalled(); // nothing leaves the browser before the review
    await user.click(screen.getByRole("radio", { name: /Бизнес сайт/ }));
    expect(screen.queryByText(t.errors.required)).not.toBeInTheDocument();
    await next(user);
    expect(screen.getByTestId("configurator-step-title")).toHaveTextContent(t.steps.scope);
    expect(screen.getByText("Стъпка 2 от 7")).toBeInTheDocument();
  });

  it("offers only what the project type supports", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("radio", { name: /Лендинг страница/ }));
    await next(user);
    expect(screen.getByRole("radio", { name: "Една" })).toBeChecked(); // a landing page is one page
    expect(screen.getByRole("radio", { name: "До 15" })).toBeDisabled();
    expect(screen.queryByTestId("q-products")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Един" }));
    await user.click(screen.getByRole("radio", { name: "Нов проект" }));
    await next(user);
    const features = screen.getByTestId("q-features");
    expect(within(features).queryByRole("checkbox", { name: "Онлайн плащания" })).not.toBeInTheDocument();
    expect(within(features).queryByRole("checkbox", { name: "Интеграция с куриери" })).not.toBeInTheDocument();
    expect(within(features).getByRole("checkbox", { name: "SEO" })).toBeInTheDocument();
  });

  it("sends enumerated answers only and shows the review the server returns", async () => {
    const user = userEvent.setup();
    mount();
    await fillBusinessWebsite(user);
    const result = await screen.findByTestId("review-result");
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/public/configurator/review")!;
    const body = JSON.parse(call[1].body as string);
    expect(body.model_version).toBe(CONFIGURATOR_MODEL_VERSION);
    expect(body.answers).toMatchObject({ project_type: "business_website", pages: "up_to_5", products: "none", features: ["seo"], timeline: "flexible", budget_range: "undisclosed" });
    expect(JSON.stringify(body)).not.toMatch(/price|amount|total|810|€/); // the browser never sends an amount

    expect(screen.getByText(t.review.notice)).toBeInTheDocument();
    expect(within(result).getByTestId("review-package")).toHaveTextContent("Бизнес сайт");
    const items = within(result).getByTestId("review-items");
    expect(within(items).getByText(/от 810\s€$/)).toBeInTheDocument();
    expect(within(items).getByText(/от 180\s€ на месец/)).toBeInTheDocument();
    expect(within(result).getByTestId("review-unpriced")).toHaveTextContent("Блог");
    expect(within(result).getByTestId("review-unpriced")).toHaveTextContent(t.review.unpricedLabels.additional_languages);
    expect(within(result).getByTestId("review-reasons")).toHaveTextContent(t.review.reasonLabels.indicative_only);
    expect(within(result).getByTestId("review-exclusions")).toHaveTextContent(t.review.exclusionLabels.hosting);
    // One-time and recurring are never added together.
    expect(within(result).getByTestId("review-totals").querySelector('[data-total="one-time"]')).toHaveTextContent(/^810\s€$/);
    expect(within(result).getByTestId("review-totals").querySelector('[data-total="monthly"]')).toHaveTextContent(/^180\s€ на месец$/);
  });

  it("shows 'requires assessment' instead of a price when the package has none", async () => {
    reviewResponse = () =>
      jsonResponse(200, {
        ...REVIEW,
        package: "landing_page",
        items: [{ kind: "package", key: "landing_page", reason: "landing_page", band: null }],
        unpriced: ["package_scope"],
        totals: { one_time_from: 0, monthly_from: 0, primary_priced: false },
      });
    const user = userEvent.setup();
    mount();
    await fillBusinessWebsite(user);
    const result = await screen.findByTestId("review-result");
    expect(within(result).getByTestId("review-items")).toHaveTextContent(t.review.requiresAssessment);
    expect(within(result).getByTestId("review-items").textContent).not.toMatch(/€/);
    expect(within(result).getByTestId("review-totals")).toHaveTextContent(t.review.primaryUnpriced);
  });

  it("explains an unsupported combination with the rule the server names", async () => {
    reviewResponse = () => jsonResponse(422, { code: "unsupported_combination", errors: [{ field: "answers", type: "feature_not_for_type:shipping" }] });
    const user = userEvent.setup();
    mount();
    await fillBusinessWebsite(user);
    const error = await screen.findByTestId("review-error");
    expect(error).toHaveTextContent(t.errors.unsupported);
    expect(error).toHaveTextContent(t.review.ruleLabels.feature_not_for_type);
    expect(error).toHaveTextContent("Интеграция с куриери");
    expect(screen.queryByTestId("configurator-quote")).not.toBeInTheDocument();
  });

  it("validates the quote form, sends it once with one submission id and keeps contact details out of storage", async () => {
    const user = userEvent.setup();
    mount();
    await fillBusinessWebsite(user);
    const form = await screen.findByTestId("configurator-quote-form");
    await user.click(within(form).getByRole("button", { name: dict.form.submit }));
    expect(within(form).getByText(dict.validation.privacy)).toBeInTheDocument();
    expect(within(form).getByLabelText(/Имейл/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/public/configurator/submissions")).toHaveLength(0);

    await user.type(within(form).getByLabelText(/Име и фамилия/), "Тест Потребител");
    await user.type(within(form).getByLabelText(/Фирма/), "Пример ООД");
    await user.type(within(form).getByLabelText(/Имейл/), "test@example.com");
    await user.click(within(form).getByRole("checkbox", { name: /Запознах се с/ }));
    expect(window.sessionStorage.getItem(`acs.configurator.${CONFIGURATOR_MODEL_VERSION}`)).not.toMatch(/example\.com|Пример/);
    await user.dblClick(within(form).getByRole("button", { name: dict.form.submit }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("AB12CD34"));
    const sent = fetchMock.mock.calls.filter(([url]) => url === "/api/public/configurator/submissions");
    expect(sent).toHaveLength(1);
    const body = JSON.parse(sent[0][1].body as string);
    expect(body.submission_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(body).toMatchObject({ locale: "bg", form_token: "tok-1", privacy_acknowledged: true, marketing_consent: false, email: "test@example.com" });
    expect(window.sessionStorage.getItem(`acs.configurator.${CONFIGURATOR_MODEL_VERSION}`)).toBeNull(); // the draft is gone after sending
  });

  it("restores the answers after a reload and goes back a step with the browser's back button", async () => {
    const user = userEvent.setup();
    const first = mount();
    await user.click(screen.getByRole("radio", { name: /Онлайн магазин/ }));
    await next(user);
    expect(window.location.hash).toBe("#scope");
    first.unmount();
    mount();
    await waitFor(() => expect(screen.getByTestId("configurator-step-title")).toHaveTextContent(t.steps.scope));
    expect(screen.getByTestId("q-products")).toBeInTheDocument(); // a store asks about products
    window.history.replaceState(null, "", "/bg/konfigurator");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByTestId("configurator-step-title")).toHaveTextContent(t.steps.type));
    expect(screen.getByRole("radio", { name: /Онлайн магазин/ })).toBeChecked();
  });
});

describe("ProjectConfigurator with the quote basket switched on", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockReset();
  });

  it("ends in 'add to the request' instead of the contact form, and sends the answers as a basket item", async () => {
    const user = userEvent.setup();
    mount({ href: "/bg/zayavka", texts: basketTexts });
    await fillBusinessWebsite(user);
    await screen.findByTestId("review-result");
    expect(screen.queryByTestId("configurator-quote-form")).not.toBeInTheDocument();
    const section = screen.getByTestId("configurator-basket");
    expect(within(section).getByRole("link", { name: basketTexts.open })).toHaveAttribute("href", "/bg/zayavka");
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/public/quote-basket" && init?.method === "POST") return jsonResponse(201, { token: "t".repeat(43), basket: { status: "open", version: 2, items: [] } });
      return jsonResponse(404, {});
    });
    await user.click(within(section).getByRole("button", { name: basketTexts.add }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bg/zayavka"));
    const created = fetchMock.mock.calls.find(([url, init]) => url === "/api/public/quote-basket" && init?.method === "POST")!;
    const body = JSON.parse(created[1].body as string);
    expect(body.item).toMatchObject({ kind: "configuration", model_version: CONFIGURATOR_MODEL_VERSION, answers: { project_type: "business_website", features: ["seo"] } });
    expect(JSON.stringify(body)).not.toMatch(/price|amount|total|â¬/);
    expect(window.sessionStorage.getItem(`acs.configurator.${CONFIGURATOR_MODEL_VERSION}`)).toBeNull(); // the draft moved to the request
  });

  it("says so when the request is full, and stays on the page", async () => {
    const user = userEvent.setup();
    mount({ href: "/bg/zayavka", texts: basketTexts });
    await fillBusinessWebsite(user);
    await screen.findByTestId("review-result");
    fetchMock.mockImplementation(async () => jsonResponse(422, { code: "basket_full" }));
    await user.click(screen.getByRole("button", { name: basketTexts.add }));
    expect(await screen.findByText(basketTexts.full)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ConfiguratorEntry", () => {
  beforeEach(() => resetConfiguratorEnabledCache());

  it("renders nothing while the configurator is switched off or the flag cannot be read", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { enabled: false }));
    const { container } = render(<ConfiguratorEntry href="/bg/konfigurator" label="Конфигурирайте проект" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/configurator-flag", { cache: "no-store" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the link once the configurator is on", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { enabled: true }));
    render(<ConfiguratorEntry href="/bg/konfigurator" label="Конфигурирайте проект" />);
    expect(await screen.findByRole("link", { name: "Конфигурирайте проект" })).toHaveAttribute("href", "/bg/konfigurator");
  });
});
