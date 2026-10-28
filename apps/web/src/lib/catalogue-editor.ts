/**
 * Form state of the admin catalogue editor and its mapping to the PATCH body.
 *
 * The API is the authority: it validates every field again and rejects markup. The checks here
 * only give immediate feedback with the same rules (lengths, plain text), so most mistakes are
 * visible before saving.
 */

import type {
  CatalogueEntity,
  CatalogueFamily,
  CatalogueItem,
  CatalogueLocale,
  CatalogueServiceFields,
  DeliveryStatus,
} from "@/lib/admin-types";

export const CATALOGUE_LOCALES: CatalogueLocale[] = ["bg", "en"];

export const TEXT_LIMITS = {
  slug: 80,
  name: 160,
  short_name: 80,
  summary: 300,
  body: 2000,
  cta_label: 80,
  seo_title: 70,
  seo_description: 175,
  item_title: 200,
  item_body: 1000,
} as const;

/** Publishing limits (the API enforces them on publish; drafts may differ). */
export function seoLimits(type: "domain" | "service") {
  return type === "domain"
    ? { titleMax: 60, descriptionMin: 120, descriptionMax: 160 }
    : { titleMax: 70, descriptionMin: 70, descriptionMax: 175 };
}

export type TextField = "slug" | "name" | "short_name" | "summary" | "body" | "cta_label" | "seo_title" | "seo_description";

export interface ServiceForm {
  primary_domain: string;
  delivery_status: DeliveryStatus;
  position: string;
  duration_min_days: string;
  duration_max_days: string;
}

export interface FamilyForm {
  key: string;
  delivery_status: DeliveryStatus;
  services: string[];
  via: string[];
  bg: { name: string; summary: string; prerequisite: string };
  en: { name: string; summary: string; prerequisite: string };
}

export interface EditorForm {
  translations: Record<CatalogueLocale, Record<TextField, string>>;
  capabilities: CatalogueItem[];
  deliverables: CatalogueItem[];
  related: string[];
  service: ServiceForm | null;
  /** Domains only. */
  families: FamilyForm[] | null;
}

export const FAMILY_KEY = /^[a-z][a-z0-9_]{0,40}$/;

function familyForm(family: CatalogueFamily): FamilyForm {
  const text = (locale: CatalogueLocale) => ({
    name: family[locale].name,
    summary: family[locale].summary ?? "",
    prerequisite: family[locale].prerequisite ?? "",
  });
  return { key: family.key, delivery_status: family.delivery_status, services: [...family.services], via: [...family.via], bg: text("bg"), en: text("en") };
}

export function emptyFamily(key: string): FamilyForm {
  const text = { name: "", summary: "", prerequisite: "" };
  return { key, delivery_status: "custom", services: [], via: [], bg: { ...text }, en: { ...text } };
}

const TEXT_FIELDS: TextField[] = ["slug", "name", "short_name", "summary", "body", "cta_label", "seo_title", "seo_description"];

export function formFromEntity(entity: CatalogueEntity): EditorForm {
  const translations = Object.fromEntries(
    CATALOGUE_LOCALES.map((locale) => [
      locale,
      Object.fromEntries(TEXT_FIELDS.map((field) => [field, entity.translations[locale][field] ?? ""])),
    ]),
  ) as EditorForm["translations"];
  return {
    translations,
    capabilities: entity.capabilities.map(copyItem),
    deliverables: entity.deliverables.map(copyItem),
    related: [...entity.related],
    service: entity.service ? serviceForm(entity.service) : null,
    families: entity.domain ? entity.domain.families.map(familyForm) : null,
  };
}

function serviceForm(service: CatalogueServiceFields): ServiceForm {
  return {
    primary_domain: service.primary_domain ?? "",
    delivery_status: service.delivery_status,
    position: String(service.position),
    duration_min_days: service.duration_min_days === null ? "" : String(service.duration_min_days),
    duration_max_days: service.duration_max_days === null ? "" : String(service.duration_max_days),
  };
}

function copyItem(item: CatalogueItem): CatalogueItem {
  return { bg: { ...item.bg }, en: { ...item.en } };
}

export function emptyItem(): CatalogueItem {
  return { bg: { title: "", body: "" }, en: { title: "", body: "" } };
}

const blank = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

function itemPayload(item: CatalogueItem, withTitle: boolean) {
  return Object.fromEntries(
    CATALOGUE_LOCALES.map((locale) => [
      locale,
      { title: withTitle ? blank(item[locale].title) : null, body: blank(item[locale].body) },
    ]),
  );
}

const number = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));

/** The PATCH body for the current form state. */
export function payloadFromForm(form: EditorForm, type: "domain" | "service") {
  const translations = Object.fromEntries(
    CATALOGUE_LOCALES.map((locale) => {
      const texts = form.translations[locale];
      return [
        locale,
        {
          name: texts.name.trim(),
          slug: blank(texts.slug),
          short_name: type === "service" ? blank(texts.short_name) : null,
          summary: blank(texts.summary),
          body: blank(texts.body),
          cta_label: type === "domain" ? blank(texts.cta_label) : null,
          seo_title: blank(texts.seo_title),
          seo_description: blank(texts.seo_description),
        },
      ];
    }),
  );
  return {
    translations,
    capabilities: type === "service" ? form.capabilities.map((item) => itemPayload(item, true)) : [],
    deliverables: form.deliverables.map((item) => itemPayload(item, false)),
    related: form.related,
    service: form.service
      ? {
          primary_domain: form.service.primary_domain || null,
          delivery_status: form.service.delivery_status,
          position: Number(form.service.position) || 0,
          duration_min_days: number(form.service.duration_min_days),
          duration_max_days: number(form.service.duration_max_days),
        }
      : null,
    ...(type === "domain" && form.families
      ? {
          families: form.families.map((family) => ({
            key: family.key,
            delivery_status: family.delivery_status,
            services: family.services,
            via: family.via,
            ...Object.fromEntries(
              CATALOGUE_LOCALES.map((locale) => [
                locale,
                { name: family[locale].name.trim(), summary: blank(family[locale].summary), prerequisite: blank(family[locale].prerequisite) },
              ]),
            ),
          })),
        }
      : {}),
  };
}

/** True when the form differs from the saved entity (drives the unsaved-changes warning). */
export function isDirty(form: EditorForm, entity: CatalogueEntity): boolean {
  return JSON.stringify(payloadFromForm(form, entity.type)) !== JSON.stringify(payloadFromForm(formFromEntity(entity), entity.type));
}

// Mirrors apps/api/app/catalogue/text.py.
const MARKUP = /<\s*[/!?]?\s*[a-zA-Z]|&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]{2,8});|!?\[[^\]]*\]\([^)]*\)|(?:javascript|vbscript|data)\s*:/i;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ClientProblem = "markup" | "control_chars" | "catalogue_slug" | "catalogue_key" | "missing" | "duration";

/** Client-side problems keyed like the API's field errors (e.g. `translations.en.summary`). */
export function validateForm(form: EditorForm): Record<string, ClientProblem> {
  const problems: Record<string, ClientProblem> = {};
  const check = (path: string, value: string | null | undefined, multiline = false) => {
    if (!value) return;
    if (CONTROL.test(value) || (!multiline && /[\n\t]/.test(value))) problems[path] = "control_chars";
    else if (MARKUP.test(value)) problems[path] = "markup";
  };
  for (const locale of CATALOGUE_LOCALES) {
    const texts = form.translations[locale];
    if (!texts.name.trim()) problems[`translations.${locale}.name`] = "missing";
    for (const field of TEXT_FIELDS) check(`translations.${locale}.${field}`, texts[field], field === "body");
    if (texts.slug.trim() && !SLUG.test(texts.slug.trim())) problems[`translations.${locale}.slug`] = "catalogue_slug";
  }
  for (const [name, list] of [["capabilities", form.capabilities], ["deliverables", form.deliverables]] as const) {
    list.forEach((item, index) => {
      for (const locale of CATALOGUE_LOCALES) {
        check(`${name}.${index}.${locale}.title`, item[locale].title);
        check(`${name}.${index}.${locale}.body`, item[locale].body, true);
      }
    });
  }
  form.families?.forEach((family, index) => {
    if (!FAMILY_KEY.test(family.key)) problems[`families.${index}.key`] = "catalogue_key";
    for (const locale of CATALOGUE_LOCALES) {
      const text = family[locale];
      if (!text.name.trim()) problems[`families.${index}.${locale}.name`] = "missing";
      check(`families.${index}.${locale}.name`, text.name);
      check(`families.${index}.${locale}.summary`, text.summary);
      check(`families.${index}.${locale}.prerequisite`, text.prerequisite);
    }
  });
  if (form.service) {
    const low = number(form.service.duration_min_days);
    const high = number(form.service.duration_max_days);
    const invalid = (low === null) !== (high === null) || (low !== null && high !== null && (Number.isNaN(low) || Number.isNaN(high) || low < 0.5 || high > 99 || high < low));
    if (invalid) problems["service.duration_min_days"] = "duration";
  }
  return problems;
}

/** Moves an element of a list (used for capabilities, deliverables and related entries). */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
