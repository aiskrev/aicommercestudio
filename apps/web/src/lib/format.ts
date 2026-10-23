import { type Locale, localeMeta } from "@/i18n/config";

export function formatDate(value: string | Date, locale: Locale = "bg"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(localeMeta[locale].dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Sofia",
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: Locale = "bg"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(localeMeta[locale].dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sofia",
  }).format(date);
}
