import { cookies } from "next/headers";

import { adminDictionaries } from "@/i18n/admin";
import { defaultLocale, isLocale, type Locale, LOCALE_COOKIE } from "@/i18n/config";

/**
 * The admin panel has no locale in its URLs: it follows the same explicit language preference
 * cookie as the public site (set by the BG | EN switchers), defaulting to Bulgarian.
 */
export async function getAdminLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}

export async function getAdminDictionary() {
  return adminDictionaries[await getAdminLocale()];
}
