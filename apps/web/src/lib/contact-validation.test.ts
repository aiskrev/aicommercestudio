import { describe, expect, it } from "vitest";

import { bg } from "@/i18n/dictionaries/bg";
import {
  type ContactValues,
  emptyContactValues,
  submissionEndpoint,
  toPayload,
  validateContact,
} from "@/lib/contact-validation";

const services = ["seo", "maintenance", "other"];

function valid(overrides: Partial<ContactValues> = {}): ContactValues {
  return {
    ...emptyContactValues(),
    service: "seo",
    name: "Иван Петров",
    company: "Примерна Фирма ЕООД",
    email: "ivan@example.com",
    phone: "+359 88 123 4567",
    message: "Нуждаем се от технически SEO одит на нашия онлайн магазин.",
    privacy_acknowledged: true,
    ...overrides,
  };
}

describe("validateContact", () => {
  it("accepts a valid submission", () => {
    expect(validateContact(valid(), bg.validation, services)).toEqual({});
  });

  it("requires all mandatory fields", () => {
    const errors = validateContact(emptyContactValues(), bg.validation, services);
    expect(Object.keys(errors).sort()).toEqual(
      ["company", "email", "message", "name", "privacy_acknowledged", "service"].sort(),
    );
  });

  it("phone is optional but must be valid when present", () => {
    expect(validateContact(valid({ phone: "" }), bg.validation, services).phone).toBeUndefined();
    expect(validateContact(valid({ phone: "обади се" }), bg.validation, services).phone).toBe(bg.validation.phone);
  });

  it.each([
    [{ email: "not-an-email" }, "email"],
    [{ service: "crypto" }, "service"],
    [{ message: "Кратко" }, "message"],
    [{ name: "А" }, "name"],
    [{ company: "Visit https://spam.example" }, "company"],
    [{ privacy_acknowledged: false }, "privacy_acknowledged"],
  ] as const)("rejects %o", (overrides, field) => {
    expect(validateContact(valid(overrides), bg.validation, services)[field]).toBeTruthy();
  });

  it("formats length messages with the limit", () => {
    expect(validateContact(valid({ message: "Твърде кратко" }), bg.validation, services).message).toBe(
      "Въведете поне 20 символа.",
    );
  });
});

describe("toPayload", () => {
  it("trims values, converts empty phone to null and includes the form token", () => {
    const payload = toPayload(valid({ name: "  Иван  ", phone: "  " }), "token-123");
    expect(payload.name).toBe("Иван");
    expect(payload.phone).toBeNull();
    expect(payload.form_token).toBe("token-123");
    expect(payload.website).toBe("");
  });
});

describe("quote validation", () => {
  const quote = (overrides: Partial<ContactValues> = {}) =>
    valid({ inquiry_type: "quote", platform: "shopify", budget_range: "undisclosed", timeline: "flexible", ...overrides });

  it("accepts a complete quote request", () => {
    expect(validateContact(quote(), bg.validation, services)).toEqual({});
  });

  it.each([
    [{ platform: "" }, "platform"],
    [{ budget_range: "huge" }, "budget_range"],
    [{ timeline: "" }, "timeline"],
    [{ website_url: "not a site" }, "website_url"],
  ] as const)("rejects %o", (overrides, field) => {
    expect(validateContact(quote(overrides), bg.validation, services)[field]).toBeTruthy();
  });

  it("ignores quote fields for contact inquiries", () => {
    expect(validateContact(valid({ platform: "bogus" }), bg.validation, services)).toEqual({});
  });

  it("routes submissions to the right endpoint", () => {
    expect(submissionEndpoint(quote())).toBe("/api/public/quote-requests");
    expect(submissionEndpoint(valid())).toBe("/api/public/leads");
    expect(toPayload(quote({ website_url: " " }), "t")).toMatchObject({ platform: "shopify", website_url: null });
    expect(toPayload(valid(), "t")).not.toHaveProperty("platform");
  });
});
