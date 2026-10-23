import { type Locale } from "@/i18n/config";
import { bg, type Dictionary } from "@/i18n/dictionaries/bg";

const dictionaries: Record<Locale, Dictionary> = { bg };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
