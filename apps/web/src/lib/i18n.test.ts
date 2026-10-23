import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { adminDictionaries, fmt } from "@/i18n/admin";
import { bg } from "@/i18n/dictionaries/bg";
import { en } from "@/i18n/dictionaries/en";
import { adminLabels } from "@/lib/admin-labels";
import {
  AI_MANAGED_SERVICE,
  AI_OPTIONS,
  type ContactValues,
  emptyContactValues,
  looksLikeSecret,
  toPayload,
  validateContact,
} from "@/lib/contact-validation";

const CYRILLIC = /[А-Яа-яЁё]/;
// Values that are deliberately Bulgarian in the English UI (names of the other language).
const ALLOWED_CYRILLIC = new Set(["Български", "Превключи на български"]);

/** Every leaf string with its dotted path. */
function leaves(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
  }
  return [];
}

/** Object keys only (array positions collapsed), to compare dictionary structure. */
function shape(node: unknown, path = ""): string[] {
  if (Array.isArray(node)) return [`${path}[]`];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => shape(value, path ? `${path}.${key}` : key));
  }
  return [path];
}

describe("translations", () => {
  it("site dictionaries have identical keys", () => {
    expect(shape(en).sort()).toEqual(shape(bg).sort());
  });

  it("admin dictionaries have identical keys", () => {
    expect(shape(adminDictionaries.en).sort()).toEqual(shape(adminDictionaries.bg).sort());
  });

  it("no translation is left empty", () => {
    for (const [path, value] of [...leaves(en), ...leaves(adminDictionaries.en), ...leaves(getContent("en"))]) {
      expect(value.trim(), path).not.toBe("");
    }
  });

  it("English UI and content contain no untranslated Bulgarian text", () => {
    const sources = { dictionary: en, admin: adminDictionaries.en, content: getContent("en") };
    for (const [name, source] of Object.entries(sources)) {
      for (const [path, value] of leaves(source)) {
        if (ALLOWED_CYRILLIC.has(value)) continue;
        // Stable cross-locale keys (Bulgarian slugs) are identifiers, not visible text.
        if (/(^|\.)(key|category|relatedArticles\[\d+\]|relatedService|relatedServices\[\d+\])$/.test(path)) continue;
        expect(CYRILLIC.test(value), `${name}.${path}: ${value}`).toBe(false);
      }
    }
  });

  it("the English site never shows raw dictionary keys", () => {
    for (const [path, value] of leaves(en)) expect(value, path).not.toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
  });

  it("admin labels cover every AI Managed option in both languages", () => {
    for (const locale of ["bg", "en"] as const) {
      const ai = adminLabels(locale).aiManaged;
      for (const v of AI_OPTIONS.sector) expect(ai.sector[v], `${locale} sector ${v}`).toBeTruthy();
      for (const v of AI_OPTIONS.systemTypes) expect(ai.systemType[v], `${locale} type ${v}`).toBeTruthy();
      for (const v of AI_OPTIONS.agentsCount) expect(ai.agentsCount[v], `${locale} count ${v}`).toBeTruthy();
      for (const v of AI_OPTIONS.hosting) expect(ai.hosting[v], `${locale} hosting ${v}`).toBeTruthy();
      for (const v of AI_OPTIONS.supportInterests) expect(ai.interest[v], `${locale} interest ${v}`).toBeTruthy();
      expect(adminLabels(locale).service.ai_managed).toBeTruthy();
    }
  });

  it("fills placeholders", () => {
    expect(fmt("Page {page} of {total}", { page: 2, total: 5 })).toBe("Page 2 of 5");
    expect(fmt("{missing} stays", {})).toBe("{missing} stays");
  });
});

function aiValues(overrides: Partial<ContactValues> = {}): ContactValues {
  return {
    ...emptyContactValues(AI_MANAGED_SERVICE),
    name: "Jane Smith",
    company: "Example Ltd",
    email: "jane@example.com",
    message: "Our support agent started giving wrong answers after the last prompt change.",
    privacy_acknowledged: true,
    ai_sector: "ecommerce",
    ai_system_types: ["customer_support"],
    ai_agents_count: "2_5",
    ai_provider: "Anthropic",
    ai_support_interests: ["monitoring"],
    ai_communication_language: "en",
    ...overrides,
  };
}

describe("AI Managed Services form", () => {
  const services = ["seo", AI_MANAGED_SERVICE, "other"];

  it("accepts a complete inquiry and reports errors in the page language", () => {
    expect(validateContact(aiValues(), en.validation, services)).toEqual({});
    const errors = validateContact(aiValues({ ai_system_types: [], ai_sector: "" }), en.validation, services);
    expect(errors.ai_system_types).toBe(en.validation.selectAtLeastOne);
    expect(errors.ai_sector).toBe(en.validation.select);
    const bgErrors = validateContact(aiValues({ ai_support_interests: [] }), bg.validation, services);
    expect(bgErrors.ai_support_interests).toBe(bg.validation.selectAtLeastOne);
  });

  it("rejects anything that looks like a credential", () => {
    for (const secret of [
      "sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
      "password: hunter2hunter2",
      "AKIAABCDEFGHIJKLMNOP",
      "-----BEGIN RSA PRIVATE KEY-----",
    ]) {
      expect(looksLikeSecret(secret), secret).toBe(true);
    }
    expect(looksLikeSecret("We use Anthropic Claude through the API")).toBe(false);
    const errors = validateContact(aiValues({ ai_additional_notes: "token=abcdef123456" }), en.validation, services);
    expect(errors.ai_additional_notes).toBe(en.validation.secrets);
  });

  it("sends AI details and the language only for AI Managed Services", () => {
    const payload = toPayload(aiValues(), "tok", "en") as Record<string, unknown>;
    expect(payload.locale).toBe("en");
    expect(payload.ai_managed).toMatchObject({ sector: "ecommerce", agents_count: "2_5", hosting: null });
    const other = toPayload(aiValues({ service: "seo" }), "tok", "bg") as Record<string, unknown>;
    expect(other.ai_managed).toBeUndefined();
    expect(other.locale).toBe("bg");
  });
});
