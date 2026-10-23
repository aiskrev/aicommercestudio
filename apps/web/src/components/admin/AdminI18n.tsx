"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { type AdminDictionary, adminDictionaries } from "@/i18n/admin";
import type { Locale } from "@/i18n/config";
import { type AdminLabels, adminLabels } from "@/lib/admin-labels";

interface AdminI18n {
  locale: Locale;
  t: AdminDictionary;
  labels: AdminLabels;
}

const AdminI18nContext = createContext<AdminI18n | null>(null);

export function AdminI18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: adminDictionaries[locale], labels: adminLabels(locale) }), [locale]);
  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

/** Admin strings and labels in the admin's language (Bulgarian outside a provider, e.g. in isolated tests). */
export function useAdminI18n(): AdminI18n {
  const context = useContext(AdminI18nContext);
  return context ?? { locale: "bg", t: adminDictionaries.bg, labels: adminLabels("bg") };
}
