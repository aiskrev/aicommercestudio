import { type Locale } from "@/i18n/config";
import { bg, type Dictionary } from "@/i18n/dictionaries/bg";
import { en } from "@/i18n/dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { bg, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
