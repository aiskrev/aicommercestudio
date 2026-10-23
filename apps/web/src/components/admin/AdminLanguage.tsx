"use client";

import { useRouter } from "next/navigation";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { rememberLocale } from "@/components/layout/LanguageSwitcher";
import { type Locale, localeMeta } from "@/i18n/config";

/**
 * BG | EN toggle for the admin panel. Admin URLs carry no locale, so the choice is stored in the
 * shared language preference cookie and the server components re-render with it.
 */
export function AdminLanguageSwitch() {
  const router = useRouter();
  const { locale, t } = useAdminI18n();
  const target: Locale = locale === "bg" ? "en" : "bg";
  return (
    <div role="group" aria-label={t.shell.language} className="inline-flex items-center gap-1 text-xs font-semibold">
      <span aria-current="true" className="rounded-full bg-white/[0.08] px-2 py-1 text-white" lang={localeMeta[locale].htmlLang}>
        {localeMeta[locale].short}
      </span>
      <button
        type="button"
        lang={localeMeta[target].htmlLang}
        aria-label={t.shell.switchTo}
        onClick={() => {
          rememberLocale(target);
          router.refresh();
        }}
        className="rounded-full px-2 py-1 text-slate-400 hover:text-white"
        data-testid="admin-language-switch"
      >
        {localeMeta[target].short}
      </button>
    </div>
  );
}
