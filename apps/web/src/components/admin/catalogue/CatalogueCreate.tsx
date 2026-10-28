"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { useAdminRole } from "@/components/admin/AdminRole";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { Alert, buttonClass } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { CatalogueEntity, CatalogueOptions, OfferingType } from "@/lib/admin-types";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

/** Creates a draft service, assessment or workshop; the editor opens next. */
export function CatalogueCreate() {
  const { t: dict, locale, labels } = useAdminI18n();
  const t = dict.catalogue;
  const role = useAdminRole();
  const router = useRouter();
  const options = useAdminData<CatalogueOptions>("/api/admin/catalogue/options");
  const [form, setForm] = useState({ key: "", offering_type: "service" as OfferingType, primary_domain: "", lead_category: "", name_bg: "", name_en: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (name: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [name]: value }));
  const header = (
    <>
      <Link href={routes.adminCatalogue} className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        {t.back}
      </Link>
      <AdminPageHeader title={t.newTitle} description={t.newDescription} />
    </>
  );
  if (role === "viewer") return <>{header}<Alert tone="info">{t.readOnlyText}</Alert></>;
  if (options.error) return <>{header}<ErrorState message={options.error} requestId={options.errorId} onRetry={options.reload} /></>;
  if (!options.data) return <>{header}<LoadingState rows={3} /></>;

  const isService = form.offering_type === "service";
  const categories = options.data.free_lead_categories;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage(null);
    try {
      const created = await adminFetch<CatalogueEntity>("/api/admin/catalogue/entities", {
        method: "POST",
        body: JSON.stringify({
          key: form.key.trim(),
          offering_type: form.offering_type,
          primary_domain: form.primary_domain || null,
          lead_category: isService ? form.lead_category || null : null,
          name_bg: form.name_bg.trim(),
          name_en: form.name_en.trim(),
        }),
      });
      router.push(routes.adminCatalogueEntry(created.id));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.code === "key_taken" ? { key: error.message } : error.fieldErrors);
        setMessage(error.message);
      } else setMessage(dict.common.saveError);
      setSaving(false);
    }
  }

  const field = (name: keyof typeof form, label: string, input: ReactNode, hint?: string) => (
    <div className="grid gap-1.5 text-sm">
      <label htmlFor={`new-${name}`} className="text-slate-300">
        {label}
      </label>
      {input}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {errors[name] && (
        <p id={`new-${name}-error`} className="text-xs text-rose-300">
          {errors[name]}
        </p>
      )}
    </div>
  );
  const described = (name: string) => (errors[name] ? `new-${name}-error` : undefined);

  return (
    <>
      {header}
      <Panel>
        <form onSubmit={submit} className="grid max-w-2xl gap-5" noValidate>
          {message && (
            <Alert tone="error" role="alert">
              {message}
            </Alert>
          )}
          {field(
            "offering_type",
            t.offeringType,
            <select id="new-offering_type" className="field" value={form.offering_type} onChange={(e) => set("offering_type")(e.target.value)}>
              {(["service", "assessment", "workshop"] as const).map((value) => (
                <option key={value} value={value}>
                  {t.types[value]}
                </option>
              ))}
            </select>,
          )}
          {field(
            "key",
            t.key,
            <input
              id="new-key"
              className="field font-mono"
              required
              maxLength={60}
              pattern="[a-z][a-z0-9_]*"
              value={form.key}
              aria-invalid={Boolean(errors.key)}
              aria-describedby={described("key")}
              onChange={(e) => set("key")(e.target.value)}
            />,
            t.keyHint,
          )}
          {field(
            "primary_domain",
            t.primaryDomain,
            <select
              id="new-primary_domain"
              className="field"
              value={form.primary_domain}
              aria-invalid={Boolean(errors.primary_domain)}
              aria-describedby={described("primary_domain")}
              onChange={(e) => set("primary_domain")(e.target.value)}
            >
              <option value="">{t.chooseDomain}</option>
              {options.data.domains.map((domain) => (
                <option key={domain.key} value={domain.key}>
                  {domain.code} · {locale === "en" ? domain.name_en : domain.name_bg}
                </option>
              ))}
            </select>,
          )}
          {isService &&
            field(
              "lead_category",
              t.leadCategory,
              categories.length === 0 ? (
                <p className="text-slate-400">{t.noFreeCategory}</p>
              ) : (
                <select
                  id="new-lead_category"
                  className="field"
                  value={form.lead_category}
                  aria-invalid={Boolean(errors.lead_category)}
                  aria-describedby={described("lead_category")}
                  onChange={(e) => set("lead_category")(e.target.value)}
                >
                  <option value="">—</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {labels.service[category as keyof typeof labels.service] ?? category}
                    </option>
                  ))}
                </select>
              ),
              t.leadCategoryHint,
            )}
          {field(
            "name_bg",
            t.nameBg,
            <input id="new-name_bg" className="field" required maxLength={160} value={form.name_bg} onChange={(e) => set("name_bg")(e.target.value)} />,
          )}
          {field(
            "name_en",
            t.nameEn,
            <input id="new-name_en" className="field" required maxLength={160} value={form.name_en} onChange={(e) => set("name_en")(e.target.value)} />,
          )}
          <button type="submit" className={buttonClass("primary")} disabled={saving || (isService && categories.length === 0)}>
            {saving ? t.creating : t.createSubmit}
          </button>
        </form>
      </Panel>
    </>
  );
}
