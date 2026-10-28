"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { kindOf, STATUS_TONE } from "@/components/admin/catalogue/CatalogueList";
import { ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { Alert, buttonClass, cx } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type {
  CatalogueChecks,
  DeliveryStatus,
  CatalogueEntity,
  CatalogueHistoryEntry,
  CatalogueItem,
  CatalogueLocale,
  CatalogueOptions,
  CataloguePreview,
} from "@/lib/admin-types";
import {
  CATALOGUE_LOCALES,
  type EditorForm,
  emptyFamily,
  emptyItem,
  FAMILY_KEY,
  type FamilyForm,
  formFromEntity,
  isDirty,
  move,
  payloadFromForm,
  seoLimits,
  TEXT_LIMITS,
  type TextField,
  validateForm,
} from "@/lib/catalogue-editor";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

type Notice = { tone: "success" | "error" | "info"; text: string } | null;

/** Loads the entry and the pickers, then hands over to the form. */
export function CatalogueEditor({ id }: { id: string }) {
  const { t } = useAdminI18n();
  const entity = useAdminData<CatalogueEntity>(`/api/admin/catalogue/entities/${id}`);
  const options = useAdminData<CatalogueOptions>("/api/admin/catalogue/options");
  const back = (
    <Link href={routes.adminCatalogue} className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
      {t.catalogue.back}
    </Link>
  );
  const failed = entity.error ?? options.error;
  if (failed) return <>{back}<ErrorState message={failed} requestId={entity.errorId ?? options.errorId} onRetry={entity.reload} /></>;
  if (!entity.data || !options.data) return <>{back}<LoadingState rows={8} /></>;
  return <EditorForm key={entity.data.id} initial={entity.data} options={options.data} />;
}

function EditorForm({ initial, options }: { initial: CatalogueEntity; options: CatalogueOptions }) {
  const { t: dict, locale: adminLocale, labels } = useAdminI18n();
  const t = dict.catalogue;
  const [entity, setEntity] = useState(initial);
  const [form, setForm] = useState<EditorForm>(() => formFromEntity(initial));
  const [tab, setTab] = useState<CatalogueLocale>(adminLocale);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<null | "save" | "publish" | "archive" | "restore" | "delete">(null);
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<{ data?: CataloguePreview; error?: string } | null>(null);
  const router = useRouter();
  const checks = useAdminData<CatalogueChecks>(`/api/admin/catalogue/entities/${entity.id}/checks?r=${entity.revision}-${entity.status}`);
  const history = useAdminData<CatalogueHistoryEntry[]>(`/api/admin/catalogue/entities/${entity.id}/history?r=${entity.revision}-${entity.status}`);

  const canEdit = entity.permissions.includes("edit");
  const dirty = canEdit && isDirty(form, entity);
  const clientProblems = validateForm(form);
  const errors: Record<string, string> = { ...serverErrors };
  for (const [path, problem] of Object.entries(clientProblems)) errors[path] = t.problems[problem];
  const name = (locale: CatalogueLocale) => entity.translations[locale].name;

  // Unsaved-change protection: browser navigation and reloads.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leave = (event: MouseEvent) => {
    if (dirty && !window.confirm(t.unsavedConfirm)) event.preventDefault();
  };

  const apply = useCallback((updated: CatalogueEntity) => {
    setEntity(updated);
    setForm(formFromEntity(updated));
    setServerErrors({});
    setConflict(false);
    setPreview(null);
  }, []);

  async function request(action: "save" | "publish" | "archive" | "restore") {
    setNotice(null);
    if (action === "save" && Object.keys(clientProblems).length > 0) {
      setNotice({ tone: "error", text: t.clientErrors });
      return;
    }
    if (action === "archive" && !window.confirm(fmt(t.archiveConfirm, { name: name(adminLocale) }))) return;
    setBusy(action);
    const path = `/api/admin/catalogue/entities/${entity.id}`;
    try {
      const updated = await adminFetch<CatalogueEntity>(action === "save" ? path : `${path}/${action}`, {
        method: action === "save" ? "PATCH" : "POST",
        headers: { "If-Match": `"${entity.revision}"` },
        body: action === "save" ? JSON.stringify(payloadFromForm(form, entity.type)) : undefined,
      });
      const unchanged = action === "save" && updated.revision === entity.revision;
      apply(updated);
      const text = { save: unchanged ? t.nothingToSave : t.saved, publish: t.published, archive: t.archived, restore: t.restored }[action];
      setNotice({ tone: unchanged ? "info" : "success", text });
    } catch (error) {
      if (error instanceof ApiError && error.code === "revision_conflict") setConflict(true);
      if (error instanceof ApiError) {
        setServerErrors(error.fieldErrors);
        setNotice({ tone: "error", text: error.message });
      } else setNotice({ tone: "error", text: dict.common.saveError });
    } finally {
      setBusy(null);
    }
  }

  async function deleteDraft() {
    if (!window.confirm(fmt(t.deleteConfirm, { name: name(adminLocale) }))) return;
    setNotice(null);
    setBusy("delete");
    try {
      await adminFetch<void>(`/api/admin/catalogue/entities/${entity.id}`, {
        method: "DELETE",
        headers: { "If-Match": `"${entity.revision}"` },
      });
      router.push(routes.adminCatalogue);
    } catch (error) {
      if (error instanceof ApiError && error.code === "revision_conflict") setConflict(true);
      setNotice({ tone: "error", text: error instanceof ApiError ? error.message : dict.common.saveError });
      setBusy(null);
    }
  }

  async function reload() {
    setNotice(null);
    try {
      apply(await adminFetch<CatalogueEntity>(`/api/admin/catalogue/entities/${entity.id}`));
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof ApiError ? error.message : dict.common.unexpected });
    }
  }

  async function togglePreview() {
    if (preview) {
      setPreview(null);
      return;
    }
    try {
      const data = await adminFetch<CataloguePreview>(`/api/admin/catalogue/entities/${entity.id}/preview?locale=${tab}`);
      setPreview({ data });
    } catch (error) {
      setPreview({ error: error instanceof ApiError ? error.message : dict.common.unexpected });
    }
  }

  const setText = (locale: CatalogueLocale, field: TextField, value: string) =>
    setForm((current) => ({
      ...current,
      translations: { ...current.translations, [locale]: { ...current.translations[locale], [field]: value } },
    }));

  const errorCount = (locale: CatalogueLocale) =>
    Object.keys(errors).filter((path) => path.startsWith(`translations.${locale}.`) || path.includes(`.${locale}.`)).length;

  const kind = kindOf({ type: entity.type, offering_type: entity.service?.offering_type ?? null });
  const limits = seoLimits(entity.type);
  const permissions = entity.permissions;

  return (
    <>
      <Link href={routes.adminCatalogue} onClick={leave} className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        {t.back}
      </Link>
      <AdminPageHeader
        title={name(adminLocale)}
        description={`${t.types[kind]} · ${entity.key}${entity.domain ? ` · ${fmt(t.domainInfo, { code: entity.domain.code })}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[entity.status]}>{t.status[entity.status]}</Pill>
            {entity.has_unpublished_changes && entity.status === "published" && (
              <Pill tone="bg-sky-400/10 text-sky-200 ring-sky-400/30">{t.unpublished}</Pill>
            )}
            {dirty && <Pill tone="bg-amber-400/10 text-amber-200 ring-amber-400/30">{t.unsavedBadge}</Pill>}
          </div>
        }
      />
      <p className="-mt-4 mb-6 text-sm text-slate-400">
        {fmt(t.revision, { n: entity.revision })} ·{" "}
        {entity.published_revision === null ? t.neverPublished : fmt(t.publishedRevision, { n: entity.published_revision })}
        {entity.published_at && ` · ${formatDateTime(entity.published_at, adminLocale)}`}
      </p>

      <div className="mb-6 grid gap-3">
        {notice && (
          <Alert tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
            {conflict && (
              <button type="button" onClick={reload} className={cx(buttonClass("secondary", "sm"), "ml-3")}>
                {t.reload}
              </button>
            )}
          </Alert>
        )}
        {entity.status === "archived" && <Alert tone="info" role="note">{t.archivedText}</Alert>}
        {!canEdit && entity.status !== "archived" && (
          <Alert tone="info" role="note" title={t.readOnly}>
            {t.readOnlyText}
          </Alert>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2" data-testid="editor-actions">
        {canEdit && (
          <button type="button" className={buttonClass("primary")} onClick={() => request("save")} disabled={busy !== null || !dirty}>
            {busy === "save" ? t.saving : t.save}
          </button>
        )}
        <button type="button" className={buttonClass("secondary")} onClick={togglePreview} aria-expanded={Boolean(preview)}>
          {preview ? t.hidePreview : t.preview}
        </button>
        {permissions.includes("publish") && (
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={() => request("publish")}
            disabled={busy !== null || dirty}
            title={dirty ? t.saveFirst : undefined}
          >
            {busy === "publish" ? t.publishing : t.publish}
          </button>
        )}
        {permissions.includes("archive") && (
          <button type="button" className={buttonClass("dangerOutline")} onClick={() => request("archive")} disabled={busy !== null}>
            {t.archive}
          </button>
        )}
        {permissions.includes("restore") && (
          <button type="button" className={buttonClass("secondary")} onClick={() => request("restore")} disabled={busy !== null}>
            {t.restore}
          </button>
        )}
        {permissions.includes("delete") && (
          <button type="button" className={buttonClass("danger")} onClick={deleteDraft} disabled={busy !== null}>
            {t.deleteDraft}
          </button>
        )}
        {dirty && permissions.includes("publish") && <p className="self-center text-sm text-amber-200">{t.saveFirst}</p>}
      </div>

      {preview && (
        <Panel title={fmt(t.previewTitle, { locale: t.locales[tab] })} className="mb-6">
          {preview.error ? (
            <Alert tone="warning" role="alert">{preview.error}</Alert>
          ) : preview.data ? (
            <PreviewBody preview={preview.data} note={t.previewNote} />
          ) : null}
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={!canEdit} className="grid min-w-0 gap-6">
          <Panel>
            <Tabs
              id="catalogue-locale"
              label={t.tabsLabel}
              value={tab}
              onChange={(value) => {
                setTab(value);
                setPreview(null);
              }}
              items={CATALOGUE_LOCALES.map((locale) => ({ value: locale, label: t.locales[locale], count: errorCount(locale) || undefined }))}
            >
              <div className="grid gap-5 pt-5">
                <TextInput path={`translations.${tab}.name`} label={t.fields.name} value={form.translations[tab].name} max={TEXT_LIMITS.name} errors={errors} onChange={(v) => setText(tab, "name", v)} required />
                {entity.type === "service" && (
                  <TextInput path={`translations.${tab}.short_name`} label={t.fields.short_name} value={form.translations[tab].short_name} max={TEXT_LIMITS.short_name} errors={errors} onChange={(v) => setText(tab, "short_name", v)} />
                )}
                <TextInput path={`translations.${tab}.slug`} label={t.fields.slug} value={form.translations[tab].slug} max={TEXT_LIMITS.slug} errors={errors} onChange={(v) => setText(tab, "slug", v)} hint={t.slugHint} mono />
                <TextInput path={`translations.${tab}.summary`} label={t.fields.summary} value={form.translations[tab].summary} max={TEXT_LIMITS.summary} errors={errors} onChange={(v) => setText(tab, "summary", v)} rows={2} />
                <TextInput path={`translations.${tab}.body`} label={t.fields.body} value={form.translations[tab].body} max={TEXT_LIMITS.body} errors={errors} onChange={(v) => setText(tab, "body", v)} rows={6} />
                {entity.type === "domain" && (
                  <TextInput path={`translations.${tab}.cta_label`} label={t.fields.cta_label} value={form.translations[tab].cta_label} max={TEXT_LIMITS.cta_label} errors={errors} onChange={(v) => setText(tab, "cta_label", v)} />
                )}
                <TextInput
                  path={`translations.${tab}.seo_title`}
                  label={t.fields.seo_title}
                  value={form.translations[tab].seo_title}
                  max={TEXT_LIMITS.seo_title}
                  errors={errors}
                  onChange={(v) => setText(tab, "seo_title", v)}
                  counter={fmt(t.counter, { n: form.translations[tab].seo_title.length, max: limits.titleMax })}
                  over={form.translations[tab].seo_title.length > limits.titleMax}
                />
                <TextInput
                  path={`translations.${tab}.seo_description`}
                  label={t.fields.seo_description}
                  value={form.translations[tab].seo_description}
                  max={TEXT_LIMITS.seo_description}
                  errors={errors}
                  onChange={(v) => setText(tab, "seo_description", v)}
                  rows={3}
                  counter={fmt(t.counterRange, { n: form.translations[tab].seo_description.length, min: limits.descriptionMin, max: limits.descriptionMax })}
                  over={(() => {
                    const n = form.translations[tab].seo_description.length;
                    return n > 0 && (n < limits.descriptionMin || n > limits.descriptionMax);
                  })()}
                />

                {entity.type === "service" && (
                  <ItemList
                    title={t.capabilities}
                    hint={t.capabilitiesHint}
                    name="capabilities"
                    items={form.capabilities}
                    locale={tab}
                    withTitle
                    errors={errors}
                    onChange={(capabilities) => setForm((current) => ({ ...current, capabilities }))}
                  />
                )}
                <ItemList
                  title={t.deliverables}
                  hint={t.capabilitiesHint}
                  name="deliverables"
                  items={form.deliverables}
                  locale={tab}
                  errors={errors}
                  onChange={(deliverables) => setForm((current) => ({ ...current, deliverables }))}
                />
              </div>
            </Tabs>
          </Panel>

          <Panel title={t.relationships}>
            <RelatedEditor
              label={entity.type === "service" ? t.relatedServices : t.relatedDomains}
              selected={form.related}
              choices={(entity.type === "service" ? options.services.filter((s) => s.status !== "archived") : options.domains).map((choice) => ({
                key: choice.key,
                name: adminLocale === "en" ? choice.name_en : choice.name_bg,
              }))}
              self={entity.key}
              errors={errors}
              onChange={(related) => setForm((current) => ({ ...current, related }))}
            />
            {form.service && entity.service && (
              <div className="mt-6 grid gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
                <h3 className="text-sm font-semibold text-white sm:col-span-2">{t.settings}</h3>
                <SelectInput
                  path="service.primary_domain"
                  label={t.primaryDomain}
                  value={form.service.primary_domain}
                  errors={errors}
                  onChange={(primary_domain) => setForm((c) => ({ ...c, service: { ...c.service!, primary_domain } }))}
                  options={[{ value: "", label: t.chooseDomain }, ...options.domains.map((d) => ({ value: d.key, label: `${d.code} · ${adminLocale === "en" ? d.name_en : d.name_bg}` }))]}
                />
                <SelectInput
                  path="service.delivery_status"
                  label={t.deliveryStatus}
                  value={form.service.delivery_status}
                  errors={errors}
                  onChange={(value) => setForm((c) => ({ ...c, service: { ...c.service!, delivery_status: value as DeliveryStatus } }))}
                  options={(["available", "custom", "planned"] as const).map((value) => ({ value, label: t.delivery[value] }))}
                />
                <TextInput
                  path="service.position"
                  label={t.position}
                  value={form.service.position}
                  max={3}
                  errors={errors}
                  inputMode="numeric"
                  onChange={(position) => setForm((c) => ({ ...c, service: { ...c.service!, position: position.replace(/\D/g, "") } }))}
                />
                {entity.service.lead_category && (
                  <p className="self-end text-sm text-slate-400">
                    {t.leadCategory}: {labels.service[entity.service.lead_category as keyof typeof labels.service] ?? entity.service.lead_category}
                  </p>
                )}
                {entity.service.offering_type !== "service" && (
                  <>
                    <TextInput path="service.duration_min_days" label={t.durationMin} value={form.service.duration_min_days} max={4} errors={errors} inputMode="decimal" hint={t.durationHint} onChange={(v) => setForm((c) => ({ ...c, service: { ...c.service!, duration_min_days: v } }))} />
                    <TextInput path="service.duration_max_days" label={t.durationMax} value={form.service.duration_max_days} max={4} errors={errors} inputMode="decimal" onChange={(v) => setForm((c) => ({ ...c, service: { ...c.service!, duration_max_days: v } }))} />
                  </>
                )}
              </div>
            )}
            {entity.domain && (
              <div className="mt-6 border-t border-white/[0.06] pt-6 text-sm">
                <h3 className="font-semibold text-white">{fmt(t.domainInfo, { code: entity.domain.code })}</h3>
                <p className="mt-1 text-slate-400">{t.domainInfoText}</p>
                {entity.domain.contact_service && <p className="mt-2 text-slate-300">{fmt(t.contactService, { category: entity.domain.contact_service })}</p>}
              </div>
            )}
          </Panel>

          {form.families && (
            <Panel title={`${t.familiesTitle} (${t.locales[tab]})`}>
              <FamilyEditor
                families={form.families}
                locale={tab}
                errors={errors}
                services={options.services.filter((s) => s.status !== "archived").map((s) => ({ key: s.key, name: adminLocale === "en" ? s.name_en : s.name_bg }))}
                domains={options.domains.filter((d) => d.key !== entity.key).map((d) => ({ key: d.key, name: `${d.code} · ${adminLocale === "en" ? d.name_en : d.name_bg}` }))}
                onChange={(families) => setForm((current) => ({ ...current, families }))}
              />
            </Panel>
          )}
        </fieldset>

        <aside className="grid content-start gap-6">
          <Panel title={t.checksTitle}>
            {checks.data ? (
              checks.data.errors.length === 0 ? (
                <p className="text-sm text-emerald-300">{t.checksOk}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-300">{t.checksIntro}</p>
                  <ul className="mt-2 grid gap-1.5 text-sm text-amber-200" data-testid="publish-checks">
                    {checks.data.errors.map((problem) => (
                      <li key={problem.field}>
                        <span className="font-mono text-xs text-slate-400">{problem.field}</span> — {problem.message}
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : (
              <LoadingState rows={2} />
            )}
          </Panel>
          <Panel title={t.history}>
            {history.data && history.data.length > 0 ? (
              <ul className="grid gap-2 text-sm">
                {history.data.map((entry, index) => (
                  <li key={`${entry.created_at}-${index}`} className="text-slate-300">
                    {t.actions[entry.action as keyof typeof t.actions] ?? entry.action}
                    <span className="block text-xs text-slate-400">
                      {entry.actor_label} · {formatDateTime(entry.created_at, adminLocale)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : history.data ? (
              <p className="text-sm text-slate-400">{t.noHistory}</p>
            ) : (
              <LoadingState rows={2} />
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function FieldShell({ id, label, hint, error, counter, over, children }: { id: string; label: string; hint?: string; error?: string; counter?: string; over?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-slate-300">
          {label}
        </label>
        {counter && <span className={cx("text-xs", over ? "text-amber-200" : "text-slate-400")}>{counter}</span>}
      </div>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

const fieldId = (path: string) => `field-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;

function TextInput({
  path,
  label,
  value,
  max,
  errors,
  onChange,
  rows,
  hint,
  counter,
  over,
  required,
  mono,
  inputMode,
}: {
  path: string;
  label: string;
  value: string;
  max: number;
  errors: Record<string, string>;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
  counter?: string;
  over?: boolean;
  required?: boolean;
  mono?: boolean;
  inputMode?: "numeric" | "decimal";
}) {
  const id = fieldId(path);
  const error = errors[path];
  const common = {
    id,
    value,
    maxLength: max,
    required,
    className: cx("field", mono && "font-mono"),
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} counter={counter} over={over}>
      {rows ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
    </FieldShell>
  );
}

function SelectInput({ path, label, value, errors, onChange, options }: { path: string; label: string; value: string; errors: Record<string, string>; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  const id = fieldId(path);
  const error = errors[path];
  return (
    <FieldShell id={id} label={label} error={error}>
      <select id={id} className="field" value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function ItemList({
  title,
  hint,
  name,
  items,
  locale,
  withTitle = false,
  errors,
  onChange,
}: {
  title: string;
  hint: string;
  name: "capabilities" | "deliverables";
  items: CatalogueItem[];
  locale: CatalogueLocale;
  withTitle?: boolean;
  errors: Record<string, string>;
  onChange: (items: CatalogueItem[]) => void;
}) {
  const { t } = useAdminI18n();
  const c = t.catalogue;
  const update = (index: number, field: "title" | "body", value: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [locale]: { ...item[locale], [field]: value } } : item)));
  return (
    <section aria-label={title} className="grid gap-3 border-t border-white/[0.06] pt-5" data-testid={`items-${name}`}>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      </div>
      {items.length === 0 && <p className="text-sm text-slate-400">{c.noItems}</p>}
      <ol className="grid gap-4">
        {items.map((item, index) => (
          <li key={index} className="grid gap-3 rounded-xl border border-white/[0.06] p-4">
            {withTitle && (
              <TextInput path={`${name}.${index}.${locale}.title`} label={`${index + 1}. ${c.itemTitle}`} value={item[locale].title ?? ""} max={TEXT_LIMITS.item_title} errors={errors} onChange={(v) => update(index, "title", v)} />
            )}
            <TextInput
              path={`${name}.${index}.${locale}.body`}
              label={withTitle ? c.itemBody : `${index + 1}. ${c.deliverableBody}`}
              value={item[locale].body ?? ""}
              max={TEXT_LIMITS.item_body}
              errors={errors}
              rows={2}
              onChange={(v) => update(index, "body", v)}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(move(items, index, index - 1))} disabled={index === 0}>
                {c.moveUp}
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(move(items, index, index + 1))} disabled={index === items.length - 1}>
                {c.moveDown}
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(items.filter((_, i) => i !== index))}>
                {c.removeItem}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className={cx(buttonClass("secondary", "sm"), "justify-self-start")} onClick={() => onChange([...items, emptyItem()])} disabled={items.length >= 20}>
        {c.addItem}
      </button>
    </section>
  );
}

function RelatedEditor({
  label,
  selected,
  choices,
  self,
  errors,
  onChange,
}: {
  label: string;
  selected: string[];
  choices: { key: string; name: string }[];
  self: string;
  errors: Record<string, string>;
  onChange: (keys: string[]) => void;
}) {
  const { t } = useAdminI18n();
  const c = t.catalogue;
  const [pick, setPick] = useState("");
  const nameOf = (key: string) => choices.find((choice) => choice.key === key)?.name ?? key;
  const available = choices.filter((choice) => choice.key !== self && !selected.includes(choice.key));
  return (
    <div className="grid gap-3" data-testid="related-editor">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      {selected.length === 0 ? (
        <p className="text-sm text-slate-400">{c.noRelated}</p>
      ) : (
        <ol className="grid gap-2">
          {selected.map((key, index) => (
            <li key={key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 text-slate-200">
                {index + 1}. {nameOf(key)} <span className="font-mono text-xs text-slate-400">{key}</span>
                {errors[`related.${index}`] && <span className="block text-xs text-rose-300">{errors[`related.${index}`]}</span>}
              </span>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(move(selected, index, index - 1))} disabled={index === 0}>
                {c.moveUp}
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(move(selected, index, index + 1))} disabled={index === selected.length - 1}>
                {c.moveDown}
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(selected.filter((k) => k !== key))}>
                {c.removeItem}
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <label htmlFor="related-pick" className="sr-only">
          {c.chooseRelated}
        </label>
        <select id="related-pick" className="field max-w-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{c.chooseRelated}</option>
          {available.map((choice) => (
            <option key={choice.key} value={choice.key}>
              {choice.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          disabled={!pick || selected.length >= 8}
          onClick={() => {
            onChange([...selected, pick]);
            setPick("");
          }}
        >
          {c.addRelated}
        </button>
      </div>
    </div>
  );
}

function PreviewBody({ preview, note }: { preview: CataloguePreview; note: string }) {
  const related = preview.related ? [...preview.related.services, ...preview.related.assessments, ...preview.related.workshops] : preview.related_domains ?? [];
  return (
    <article className="grid gap-3 text-sm" data-testid="catalogue-preview">
      <p className="text-xs text-slate-400">{note}</p>
      <h3 className="text-xl font-semibold text-white">{preview.name}</h3>
      <p className="font-mono text-xs text-slate-400">/{preview.slug}</p>
      <p className="text-slate-200">{preview.summary}</p>
      <p className="whitespace-pre-wrap text-slate-300">{preview.body}</p>
      {preview.capabilities && preview.capabilities.length > 0 && (
        <ul className="grid gap-1 text-slate-300">
          {preview.capabilities.map((capability) => (
            <li key={capability.title}>
              <strong className="text-white">{capability.title}</strong> — {capability.description}
            </li>
          ))}
        </ul>
      )}
      {preview.deliverables.length > 0 && (
        <ul className="list-disc pl-5 text-slate-300">
          {preview.deliverables.map((deliverable) => (
            <li key={deliverable}>{deliverable}</li>
          ))}
        </ul>
      )}
      {related.length > 0 && <p className="text-slate-400">→ {related.map((r) => r.name).join(" · ")}</p>}
      <p className="border-t border-white/[0.06] pt-3 text-xs text-slate-400">
        SEO: {preview.seo.title} — {preview.seo.description}
      </p>
    </article>
  );
}

function KeyChips({
  label,
  selected,
  choices,
  onChange,
  max,
  idPrefix,
}: {
  label: string;
  selected: string[];
  choices: { key: string; name: string }[];
  onChange: (keys: string[]) => void;
  max: number;
  idPrefix: string;
}) {
  const { t } = useAdminI18n();
  const c = t.catalogue;
  const [pick, setPick] = useState("");
  const nameOf = (key: string) => choices.find((choice) => choice.key === key)?.name ?? key;
  return (
    <div className="grid gap-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <ul className="flex flex-wrap gap-2">
        {selected.map((key) => (
          <li key={key} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-slate-200">
            {nameOf(key)}
            <button type="button" className="text-slate-400 hover:text-white" aria-label={`${c.removeItem}: ${nameOf(key)}`} onClick={() => onChange(selected.filter((k) => k !== key))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${idPrefix}-pick`} className="sr-only">
          {label}
        </label>
        <select id={`${idPrefix}-pick`} className="field max-w-xs" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{c.chooseRelated}</option>
          {choices
            .filter((choice) => !selected.includes(choice.key))
            .map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          disabled={!pick || selected.length >= max}
          onClick={() => {
            onChange([...selected, pick]);
            setPick("");
          }}
        >
          {c.addRelated}
        </button>
      </div>
    </div>
  );
}

function FamilyEditor({
  families,
  locale,
  errors,
  services,
  domains,
  onChange,
}: {
  families: FamilyForm[];
  locale: CatalogueLocale;
  errors: Record<string, string>;
  services: { key: string; name: string }[];
  domains: { key: string; name: string }[];
  onChange: (families: FamilyForm[]) => void;
}) {
  const { t } = useAdminI18n();
  const c = t.catalogue;
  const [newKey, setNewKey] = useState("");
  const update = (index: number, change: Partial<FamilyForm>) =>
    onChange(families.map((family, i) => (i === index ? { ...family, ...change } : family)));
  const setText = (index: number, field: "name" | "summary" | "prerequisite", value: string) =>
    update(index, { [locale]: { ...families[index][locale], [field]: value } } as Partial<FamilyForm>);
  const keyTaken = families.some((family) => family.key === newKey);
  const keyValid = FAMILY_KEY.test(newKey) && !keyTaken;

  return (
    <div className="grid gap-4" data-testid="family-editor">
      <p className="text-xs text-slate-400">{c.familiesHint}</p>
      {families.length === 0 && <p className="text-sm text-slate-400">{c.noFamilies}</p>}
      <ol className="grid gap-4">
        {families.map((family, index) => (
          <li key={family.key} className="grid gap-3 rounded-xl border border-white/[0.06] p-4" data-testid={`family-${family.key}`}>
            <p className="font-mono text-xs text-slate-400">
              {index + 1}. {family.key}
            </p>
            <TextInput path={`families.${index}.${locale}.name`} label={c.familyName} value={family[locale].name} max={160} errors={errors} onChange={(v) => setText(index, "name", v)} required />
            <TextInput path={`families.${index}.${locale}.summary`} label={c.familySummary} value={family[locale].summary} max={300} errors={errors} rows={2} onChange={(v) => setText(index, "summary", v)} />
            <SelectInput
              path={`families.${index}.delivery_status`}
              label={c.deliveryStatus}
              value={family.delivery_status}
              errors={errors}
              onChange={(value) => update(index, { delivery_status: value as FamilyForm["delivery_status"] })}
              options={(["available", "custom", "planned"] as const).map((value) => ({ value, label: c.delivery[value] }))}
            />
            <TextInput path={`families.${index}.${locale}.prerequisite`} label={c.familyPrerequisite} value={family[locale].prerequisite} max={400} errors={errors} onChange={(v) => setText(index, "prerequisite", v)} />
            <KeyChips label={c.familyServices} idPrefix={`family-${index}-services`} selected={family.services} choices={services} max={10} onChange={(keys) => update(index, { services: keys })} />
            <KeyChips label={c.familyVia} idPrefix={`family-${index}-via`} selected={family.via} choices={domains} max={4} onChange={(keys) => update(index, { via: keys })} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(move(families, index, index - 1))} disabled={index === 0}>
                {c.moveUp}
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(move(families, index, index + 1))} disabled={index === families.length - 1}>
                {c.moveDown}
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(families.filter((_, i) => i !== index))}>
                {c.removeItem}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5 text-sm">
          <label htmlFor="new-family-key" className="text-slate-300">
            {c.familyKey}
          </label>
          <input
            id="new-family-key"
            className="field max-w-xs font-mono"
            value={newKey}
            maxLength={41}
            aria-invalid={newKey !== "" && !keyValid}
            onChange={(e) => setNewKey(e.target.value.trim())}
          />
        </div>
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          disabled={!keyValid || families.length >= 20}
          onClick={() => {
            onChange([...families, emptyFamily(newKey)]);
            setNewKey("");
          }}
        >
          {c.addFamily}
        </button>
      </div>
      {newKey !== "" && !keyValid && <p className="text-xs text-rose-300">{keyTaken ? c.familyKeyTaken : c.problems.catalogue_key}</p>}
    </div>
  );
}
