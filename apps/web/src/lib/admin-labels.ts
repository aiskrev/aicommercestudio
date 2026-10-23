import { getContent } from "@/content";
import { bg } from "@/i18n/dictionaries/bg";
import type { LeadStatus } from "@/lib/admin-types";

export const statusLabels: Record<LeadStatus, string> = {
  NEW: "Ново",
  CONTACTED: "Осъществен контакт",
  QUALIFIED: "Квалифицирано",
  PROPOSAL: "Изпратена оферта",
  WON: "Спечелено",
  LOST: "Загубено",
};

export const statusTone: Record<LeadStatus, string> = {
  NEW: "bg-cyan-400/10 text-cyan-200 ring-cyan-400/30",
  CONTACTED: "bg-blue-400/10 text-blue-200 ring-blue-400/30",
  QUALIFIED: "bg-violet-400/10 text-violet-200 ring-violet-400/30",
  PROPOSAL: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  WON: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  LOST: "bg-slate-400/10 text-slate-300 ring-slate-400/30",
};

export const serviceLabels: Record<string, string> = {
  ...Object.fromEntries(getContent("bg").services.map((s) => [s.key, s.shortTitle])),
  other: "Друго / не е уточнено",
};

const actionLabels: Record<string, string> = {
  "lead.created": "Ново запитване",
  "lead.status_changed": "Промяна на статус",
  "lead.note_added": "Добавена бележка",
  "lead.deleted": "Изтрито запитване",
  "auth.login": "Вход в системата",
  "auth.logout": "Изход от системата",
  "auth.login_failed": "Неуспешен опит за вход",
  "admin.created": "Създаден администратор",
  "admin.password_reset": "Сменена парола (CLI)",
  "ai.lead_triage": "AI анализ на запитване",
  "ai_action.proposed": "Предложено AI действие",
  "ai_action.approved": "Одобрено AI действие",
  "ai_action.rejected": "Отхвърлено AI действие",
  "seed.synthetic_data": "Заредени синтетични данни",
  "seed.synthetic_purged": "Изтрити синтетични данни",
  "lead.viewed": "Преглед на лични данни",
  "lead.service_changed": "Промяна на услуга",
  "auth.account_locked": "Заключен акаунт (неуспешни опити)",
  "auth.login_blocked": "Блокиран опит за вход",
  "auth.session_idle_timeout": "Изтекла сесия (неактивност)",
  "auth.logout_all": "Изход от всички устройства",
  "retention.run": "Изпълнена политика за съхранение",
};

export function actionLabel(action: string): string {
  return actionLabels[action] ?? action;
}

export const aiActionTypeLabels: Record<string, string> = {
  read_public_content: "Четене на публично съдържание",
  generate_draft: "Генериране на чернова",
  classify_lead: "Класификация на запитване",
  send_message: "Изпращане на съобщение",
  modify_product: "Промяна на продукт",
  change_price: "Промяна на цена",
  modify_order: "Промяна на поръчка",
  access_sensitive_data: "Достъп до чувствителни данни",
  delete_data: "Изтриване на данни",
};

export const riskLabels: Record<string, { label: string; tone: string }> = {
  low: { label: "Нисък риск", tone: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30" },
  high: { label: "Висок риск", tone: "bg-amber-400/10 text-amber-200 ring-amber-400/30" },
  critical: { label: "Критичен риск", tone: "bg-rose-400/10 text-rose-200 ring-rose-400/30" },
};

export const aiStatusLabels: Record<string, string> = {
  PENDING: "Чака одобрение",
  APPROVED: "Одобрено",
  REJECTED: "Отхвърлено",
  EXECUTED: "Изпълнено",
};

export const priorityLabels: Record<string, string> = { low: "Нисък", medium: "Среден", high: "Висок" };

const inquiry = bg.inquiry;

export const inquiryTypeLabels: Record<string, string> = {
  contact: inquiry.types.contact.label,
  quote: inquiry.types.quote.label,
};

export const platformLabels: Record<string, string> = inquiry.platforms;
export const budgetLabels: Record<string, string> = inquiry.budgets;
export const timelineLabels: Record<string, string> = inquiry.timelines;

/** Audit action filter options grouped for the activity page. */
export const auditActionGroups: { label: string; prefix: string }[] = [
  { label: "Запитвания", prefix: "lead." },
  { label: "Вход и сесии", prefix: "auth." },
  { label: "AI", prefix: "ai" },
  { label: "Съхранение на данни", prefix: "retention." },
];

export function knownAuditActions(): { value: string; label: string }[] {
  return Object.entries(actionLabels).map(([value, label]) => ({ value, label }));
}
