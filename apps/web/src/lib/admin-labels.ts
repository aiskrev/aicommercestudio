import { getContent } from "@/content";
import { adminDictionaries } from "@/i18n/admin";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import type { LeadStatus } from "@/lib/admin-types";

export const statusTone: Record<LeadStatus, string> = {
  NEW: "bg-cyan-400/10 text-cyan-200 ring-cyan-400/30",
  CONTACTED: "bg-blue-400/10 text-blue-200 ring-blue-400/30",
  QUALIFIED: "bg-violet-400/10 text-violet-200 ring-violet-400/30",
  PROPOSAL: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  WON: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  LOST: "bg-slate-400/10 text-slate-300 ring-slate-400/30",
};

export const riskTone: Record<string, string> = {
  low: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  high: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  critical: "bg-rose-400/10 text-rose-200 ring-rose-400/30",
};

/** Every label the admin panel shows for API values, in the admin's language. */
export function adminLabels(locale: Locale) {
  const t = adminDictionaries[locale].labels;
  const site = getDictionary(locale);
  const inquiry = site.inquiry;
  const ai = site.aiManagedForm;
  const actions: Record<string, string> = t.actions;
  return {
    status: t.status as Record<LeadStatus, string>,
    service: {
      ...Object.fromEntries(getContent(locale).services.map((s) => [s.key, s.shortTitle])),
      other: t.otherService,
    } as Record<string, string>,
    locale: t.locales as Record<string, string>,
    actionLabel: (action: string) => actions[action] ?? action,
    knownAuditActions: () => Object.entries(actions).map(([value, label]) => ({ value, label })),
    auditGroups: t.auditGroups,
    aiActionType: t.aiActionTypes as Record<string, string>,
    risk: t.risk as Record<string, string>,
    aiStatus: t.aiStatus as Record<string, string>,
    priority: t.priority as Record<string, string>,
    complexity: t.complexity as Record<string, string>,
    inquiryType: { contact: inquiry.types.contact.label, quote: inquiry.types.quote.label } as Record<string, string>,
    platform: inquiry.platforms as Record<string, string>,
    budget: inquiry.budgets as Record<string, string>,
    timeline: inquiry.timelines as Record<string, string>,
    aiManaged: {
      sector: ai.sectors as Record<string, string>,
      systemType: ai.systemTypeOptions as Record<string, string>,
      agentsCount: ai.agentsCountOptions as Record<string, string>,
      hosting: ai.hostingOptions as Record<string, string>,
      interest: ai.supportInterestOptions as Record<string, string>,
    },
  };
}

export type AdminLabels = ReturnType<typeof adminLabels>;
