import { describe, expect, it } from "vitest";

import { sampleEntity } from "@/components/admin/catalogue/test-fixtures";
import { emptyItem, formFromEntity, isDirty, move, payloadFromForm, validateForm } from "@/lib/catalogue-editor";

describe("catalogue editor form", () => {
  it("round-trips an entity without changes", () => {
    const entity = sampleEntity();
    const form = formFromEntity(entity);
    expect(isDirty(form, entity)).toBe(false);
    const payload = payloadFromForm(form, "service");
    expect(payload.translations.en).toMatchObject({ name: "SEO", slug: "seo-slug", cta_label: null });
    expect(payload.capabilities).toEqual([{ bg: { title: "Обхождане", body: "Карта на сайта" }, en: { title: "Crawlability", body: "Sitemaps" } }]);
    expect(payload.deliverables[0]).toEqual({ bg: { title: null, body: "Одит" }, en: { title: null, body: "Audit" } });
    expect(payload.service).toEqual({
      primary_domain: "commerce_engineering",
      delivery_status: "available",
      position: 1,
      duration_min_days: null,
      duration_max_days: null,
    });
  });

  it("detects changes and trims blank fields to null", () => {
    const entity = sampleEntity();
    const form = formFromEntity(entity);
    form.translations.en.summary = "   ";
    expect(isDirty(form, entity)).toBe(true);
    expect(payloadFromForm(form, "service").translations.en.summary).toBeNull();
  });

  it("drops capabilities and short names for domains and keeps the CTA", () => {
    const entity = sampleEntity({ type: "domain", service: null });
    const form = formFromEntity(entity);
    form.translations.bg.cta_label = "Заявете";
    const payload = payloadFromForm(form, "domain");
    expect(payload.capabilities).toEqual([]);
    expect(payload.translations.bg).toMatchObject({ short_name: null, cta_label: "Заявете" });
    expect(payload.service).toBeNull();
  });

  it("flags markup, invisible characters, bad slugs and an empty name like the API", () => {
    const form = formFromEntity(sampleEntity());
    form.translations.en.summary = "<b>bold</b>";
    form.translations.en.body = "See [here](javascript:alert(1))";
    form.translations.bg.name = "  ";
    form.translations.bg.slug = "Not A Slug";
    form.translations.en.seo_title = "Line\nbreak";
    form.capabilities[0].en.title = "Evil‮";
    expect(validateForm(form)).toEqual({
      "translations.en.summary": "markup",
      "translations.en.body": "markup",
      "translations.bg.name": "missing",
      "translations.bg.slug": "catalogue_slug",
      "translations.en.seo_title": "control_chars",
      "capabilities.0.en.title": "control_chars",
    });
  });

  it("allows plain prose with less-than signs and line breaks in long texts", () => {
    const form = formFromEntity(sampleEntity());
    form.translations.en.body = "Delivery in < 5 days.\nTwo paragraphs.";
    expect(validateForm(form)).toEqual({});
  });

  it("checks the duration band", () => {
    const form = formFromEntity(sampleEntity());
    form.service!.duration_min_days = "2";
    expect(validateForm(form)["service.duration_min_days"]).toBe("duration");
    form.service!.duration_max_days = "1";
    expect(validateForm(form)["service.duration_min_days"]).toBe("duration");
    form.service!.duration_max_days = "3,5";
    expect(validateForm(form)).toEqual({});
    expect(payloadFromForm(form, "service").service?.duration_max_days).toBe(3.5);
  });

  it("moves list items within bounds", () => {
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(emptyItem()).toEqual({ bg: { title: "", body: "" }, en: { title: "", body: "" } });
  });
});
