import { createElement, Fragment, type ReactNode } from "react";

import { type AdminDictionary, adminBg } from "@/i18n/admin/bg";
import { adminEn } from "@/i18n/admin/en";
import type { Locale } from "@/i18n/config";

export type { AdminDictionary };

export const adminDictionaries: Record<Locale, AdminDictionary> = { bg: adminBg, en: adminEn };

/** Fill `{name}` placeholders. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Like `fmt`, but placeholders may be React nodes (e.g. emphasised numbers). */
export function fmtNodes(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return createElement(Fragment, { key: index }, key && key in values ? values[key] : part);
  });
}
