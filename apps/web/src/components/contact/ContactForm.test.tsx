import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "@/components/contact/ContactForm";
import { bg } from "@/i18n/dictionaries/bg";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const services = [
  { value: "seo", label: "SEO и органичен растеж" },
  { value: "other", label: "Друго / не съм сигурен" },
];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/public/form-token") return jsonResponse(200, { token: "tok-1" });
    return jsonResponse(201, { status: "received", reference: "AB12CD34", message: "ok" });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm(initialService = "", initialInquiry: "contact" | "quote" = "contact") {
  return render(
    <ContactForm
      labels={bg.form}
      messages={bg.validation}
      inquiry={bg.inquiry}
      services={services}
      initialService={initialService}
      initialInquiry={initialInquiry}
      privacyHref="/poveritelnost"
    />,
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/Услуга/), "seo");
  await user.type(screen.getByLabelText(/Име и фамилия/), "Иван Петров");
  await user.type(screen.getByLabelText(/^Фирма/), "Примерна Фирма ЕООД");
  await user.type(screen.getByLabelText(/^Имейл/), "ivan@example.com");
  await user.type(screen.getByLabelText(/Описание на проекта/), "Нуждаем се от технически SEO одит на магазина.");
  await user.click(screen.getByRole("checkbox", { name: /информацията за поверителност/ }));
}

describe("ContactForm", () => {
  it("renders all fields with accessible labels", () => {
    renderForm();
    for (const label of [/Услуга/, /Име и фамилия/, /^Фирма/, /^Имейл/, /Телефон/, /Описание на проекта/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "информацията за поверителност" })).toHaveAttribute("href", "/poveritelnost");
  });

  it("pre-selects a valid initial service and ignores unknown ones", () => {
    const { unmount } = renderForm("seo");
    expect(screen.getByLabelText(/Услуга/)).toHaveValue("seo");
    unmount();
    renderForm("does-not-exist");
    expect(screen.getByLabelText(/Услуга/)).toHaveValue("");
  });

  it("shows validation errors and does not submit an empty form", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: bg.form.submit }));

    expect(await screen.findByText(bg.form.errorSummary)).toBeInTheDocument();
    expect(screen.getByText(bg.validation.service)).toBeInTheDocument();
    expect(screen.getByText(bg.validation.privacy)).toBeInTheDocument();
    expect(screen.getByLabelText(/Име и фамилия/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/public/leads")).toHaveLength(0);
  });

  it("submits a valid form and shows the reference number", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/public/form-token", expect.anything()));
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: bg.form.submit }));

    expect(await screen.findByTestId("contact-success")).toHaveTextContent("AB12CD34");
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/public/leads")!;
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      service: "seo",
      name: "Иван Петров",
      email: "ivan@example.com",
      phone: null,
      privacy_acknowledged: true,
      marketing_consent: false,
      website: "",
      form_token: "tok-1",
    });
  });

  it("maps server-side field errors onto the form", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/public/form-token") return jsonResponse(200, { token: "tok-1" });
      return jsonResponse(422, {
        detail: "Моля, коригирайте маркираните полета.",
        errors: [{ field: "email", message: "Въведете валиден имейл адрес.", type: "value_error" }],
      });
    });
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: bg.form.submit }));

    expect(await screen.findByText("Въведете валиден имейл адрес.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Имейл/)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a friendly message when rate limited", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/public/form-token" ? jsonResponse(200, { token: "t" }) : jsonResponse(429, { detail: "x" }),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: bg.form.submit }));
    expect(await screen.findByText(bg.form.rateLimited)).toBeInTheDocument();
  });
});

describe("ContactForm — quote requests", () => {
  it("shows the quote fields only for quote requests", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByTestId("quote-fields")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Заявка за оферта/ }));
    expect(screen.getByTestId("quote-fields")).toBeInTheDocument();
    expect(screen.getByLabelText(/Платформа/)).toBeInTheDocument();
  });

  it("requires platform, budget and timeline for a quote", async () => {
    const user = userEvent.setup();
    renderForm("", "quote");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: bg.form.submit }));
    expect(await screen.findAllByText(bg.validation.select)).toHaveLength(3);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("quote-requests"))).toHaveLength(0);
  });

  it("submits a quote to the quote endpoint with structured fields", async () => {
    const user = userEvent.setup();
    renderForm("", "quote");
    await fillValid(user);
    await user.selectOptions(screen.getByLabelText(/Платформа/), "shopify");
    await user.selectOptions(screen.getByLabelText(/Ориентировъчен бюджет/), "2500_10000");
    await user.selectOptions(screen.getByLabelText(/Желан срок/), "asap");
    await user.type(screen.getByLabelText(/Адрес на сайта/), "example.bg");
    await user.click(screen.getByRole("button", { name: bg.form.submit }));

    expect(await screen.findByTestId("contact-success")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("quote-requests"))!;
    expect(url).toBe("/api/public/quote-requests");
    expect(JSON.parse(init.body)).toMatchObject({
      platform: "shopify",
      budget_range: "2500_10000",
      timeline: "asap",
      website_url: "example.bg",
    });
  });

  it("does not send quote fields to the contact endpoint", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: bg.form.submit }));
    await screen.findByTestId("contact-success");
    const [, init] = fetchMock.mock.calls.find(([u]) => u === "/api/public/leads")!;
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty("platform");
    expect(body).not.toHaveProperty("website_url");
  });
});
