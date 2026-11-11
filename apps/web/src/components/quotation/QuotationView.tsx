"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { Alert, Button, buttonClass } from "@/components/ui/primitives";
import type { SiteContent } from "@/content";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import { answerQuotation, type QuotationContent, type QuotationView as View, tokenFromFragment, viewQuotation } from "@/lib/quotation";

type Texts = SiteContent["quotation"];

const LISTS = ["deliverables", "assumptions", "exclusions", "dependencies", "acceptance_criteria"] as const;

/**
 * The page of a customer-facing quotation. The secret link is in the URL fragment; the page sends it to the API in a
 * request body, shows the approved version and records one answer. Nothing is stored in the browser.
 */
export function QuotationView({ locale, texts: t, contactHref }: { locale: Locale; texts: Texts; contactHref: string }) {
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "failed" | "limited">("loading");
  const [quotation, setQuotation] = useState<View | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; confirmed?: string }>({});
  const [sending, setSending] = useState<"accept" | "decline" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const date = (value: string) => formatDateTime(value, locale);

  // The address fragment holds the secret. Pasting another link into the same tab only changes the fragment (the
  // browser does not reload the page), so the page follows it.
  const [fragment, setFragment] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setFragment(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (fragment === null) return;
    const found = tokenFromFragment(fragment);
    setToken(found);
    setQuotation(null);
    setErrors({});
    setMessage(null);
    if (!found) {
      setState("not_found");
      return;
    }
    setState("loading");
    let active = true;
    void viewQuotation(found).then((result) => {
      if (!active) return;
      if (result.ok) {
        setQuotation(result.quotation);
        setState("ready");
      } else setState(result.kind === "not_found" ? "not_found" : result.kind === "rate_limited" ? "limited" : "failed");
    });
    return () => {
      active = false;
    };
  }, [fragment]);

  async function send(decision: "accept" | "decline", event: FormEvent) {
    event.preventDefault();
    if (!token || sending) return;
    const found: typeof errors = {};
    if (name.trim().length < 2) found.name = t.answer.required;
    if (!confirmed) found.confirmed = t.answer.confirm;
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(found.name ? "quotation-name" : "quotation-confirm")?.focus();
      return;
    }
    setSending(decision);
    setMessage(null);
    const result = await answerQuotation(token, decision, name.trim(), note.trim());
    setSending(null);
    if (result.ok) setQuotation(result.quotation);
    else setMessage(result.kind === "closed" ? t.answer.closed : result.kind === "validation" ? t.answer.spam : result.kind === "rate_limited" ? t.rateLimited : t.answer.failed);
  }

  if (state === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-fg-muted" data-testid="quotation-loading">
        {t.loading}
      </p>
    );
  }
  if (state === "not_found") {
    return (
      <section className="grid gap-3" data-testid="quotation-not-found">
        <h2 className="t-h3-lg">{t.notFound.title}</h2>
        <p className="max-w-2xl text-fg-muted">{t.notFound.text}</p>
        <div>
          <Link href={contactHref} className={buttonClass("secondary")}>
            {t.notFound.contact}
          </Link>
        </div>
      </section>
    );
  }
  if (state !== "ready" || !quotation) {
    return (
      <Alert tone="error" role="alert">
        {state === "limited" ? t.rateLimited : t.failed}
      </Alert>
    );
  }

  const content = quotation.content;
  const block = (title: string, body: ReactNode, id: string) => (
    <section className="grid gap-2" aria-labelledby={`q-${id}`} data-section={id}>
      <h3 id={`q-${id}`} className="t-h3">
        {title}
      </h3>
      {body}
    </section>
  );
  const list = (items: string[]) => (
    <ul className="grid list-disc gap-1 pl-5 text-fg-secondary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
  const section = (key: keyof QuotationContent, data: QuotationContent) => {
    if (key === "scope") return data.scope.trim() ? block(t.sections.scope, <p className="max-w-3xl whitespace-pre-wrap text-fg-secondary">{data.scope}</p>, key) : null;
    if ((LISTS as readonly string[]).includes(key)) {
      const items = data[key as (typeof LISTS)[number]];
      return items.length ? block(t.sections[key as (typeof LISTS)[number]], list(items), key) : null;
    }
    if (key === "responsibilities") {
      return data.responsibilities.length
        ? block(
            t.sections.responsibilities,
            <ul className="grid gap-1 text-fg-secondary">
              {data.responsibilities.map((entry) => (
                <li key={`${entry.party}-${entry.item}`}>
                  <span className="font-semibold text-fg">{t.parties[entry.party]}:</span> {entry.item}
                </li>
              ))}
            </ul>,
            key,
          )
        : null;
    }
    if (key === "milestones") {
      return data.milestones.length
        ? block(
            t.sections.milestones,
            <ol className="grid gap-2 text-fg-secondary">
              {data.milestones.map((entry) => (
                <li key={entry.title}>
                  <span className="font-semibold text-fg">{entry.title}</span>
                  {entry.description && <span> — {entry.description}</span>}
                  {entry.indicative_timing && (
                    <span className="block text-body-sm text-fg-muted">
                      {t.milestone.timing}: {entry.indicative_timing}
                    </span>
                  )}
                </li>
              ))}
            </ol>,
            key,
          )
        : null;
    }
    if (key === "risks") {
      return data.risks.length
        ? block(
            t.sections.risks,
            <ul className="grid gap-2 text-fg-secondary">
              {data.risks.map((entry) => (
                <li key={entry.risk}>
                  {entry.risk}
                  {entry.mitigation && (
                    <span className="block text-body-sm text-fg-muted">
                      {t.risk.mitigation}: {entry.mitigation}
                    </span>
                  )}
                </li>
              ))}
            </ul>,
            key,
          )
        : null;
    }
    const entries = (Object.keys(data.commercial) as (keyof QuotationContent["commercial"])[]).filter((field) => data.commercial[field].trim());
    return entries.length
      ? block(
          t.sections.commercial,
          <dl className="grid gap-3">
            {entries.map((field) => (
              <div key={field}>
                <dt className="t-label">{t.commercial[field]}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-fg-secondary">{data.commercial[field]}</dd>
              </div>
            ))}
          </dl>,
          "commercial",
        )
      : null;
  };

  const decided = quotation.decision;
  const tone = quotation.status === "accepted" ? "success" : quotation.status === "published" ? "info" : "warning";
  return (
    <div className="tool-frame grid gap-8 p-5 sm:p-8" data-testid="quotation" data-status={quotation.status}>
      <header className="grid gap-3">
        <p className="t-label">{t.kinds[quotation.kind]}</p>
        <h2 className="t-h2">{quotation.title}</h2>
        <dl className="grid gap-x-8 gap-y-2 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">{t.for}</dt>
            <dd className="font-semibold text-fg">{quotation.company}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.reference}</dt>
            <dd className="font-semibold text-fg" data-testid="quotation-reference">
              {quotation.reference}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.published}</dt>
            <dd className="text-fg-secondary">{date(quotation.published_at)}</dd>
          </div>
          {quotation.valid_until && (
            <div>
              <dt className="text-fg-muted">{t.validUntil}</dt>
              <dd className="text-fg-secondary" data-testid="quotation-valid-until">
                {quotation.valid_until}
              </dd>
            </div>
          )}
        </dl>
        <Alert tone={tone} role="status">
          <span data-testid="quotation-status">{t.status[quotation.status]}</span>
        </Alert>
      </header>

      {quotation.status === "withdrawn" && <Alert tone="warning">{t.withdrawn}</Alert>}
      {quotation.status === "expired" && <Alert tone="warning">{t.expired}</Alert>}

      {content && (
        <div className="grid gap-6" data-testid="quotation-content">
          {(["scope", "deliverables", "assumptions", "exclusions", "dependencies", "responsibilities", "acceptance_criteria", "milestones", "risks", "commercial"] as const).map((key) => (
            <div key={key}>{section(key, content)}</div>
          ))}
        </div>
      )}

      {decided && (
        <div role="status" data-testid="quotation-decided">
          <Alert tone={quotation.status === "accepted" ? "success" : "info"}>
            {t.decided[quotation.status === "accepted" ? "accepted" : "declined"].replace("{name}", decided.name).replace("{date}", date(decided.decided_at))}
          </Alert>
        </div>
      )}

      {quotation.open && (
        <section aria-labelledby="quotation-answer-title" className="grid gap-4 border-t border-line-subtle pt-8" data-testid="quotation-answer">
          <h3 id="quotation-answer-title" className="t-h3-lg">
            {t.answer.title}
          </h3>
          <p className="max-w-2xl text-fg-muted">{t.answer.lead}</p>
          {message && (
            <Alert tone="error" role="alert">
              {message}
            </Alert>
          )}
          <form noValidate onSubmit={(event) => void send("accept", event)} className="grid gap-4">
            <div className="grid gap-1.5 sm:max-w-md">
              <label htmlFor="quotation-name" className="field-label">
                {t.answer.name}{" "}
                <span className="field-required" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="quotation-name"
                className="field"
                autoComplete="name"
                maxLength={120}
                required
                value={name}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "quotation-name-error" : undefined}
                onChange={(event) => setName(event.target.value)}
              />
              {errors.name && (
                <p id="quotation-name-error" className="field-error">
                  {errors.name}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="quotation-note" className="field-label">
                {t.answer.note}
              </label>
              <textarea id="quotation-note" className="field min-h-24" maxLength={1000} value={note} aria-describedby="quotation-note-hint" onChange={(event) => setNote(event.target.value)} />
              <p id="quotation-note-hint" className="field-hint">
                {t.answer.noteHint}
              </p>
            </div>
            <div className="grid gap-1.5">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-secondary">
                <input
                  id="quotation-confirm"
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={confirmed}
                  required
                  aria-invalid={errors.confirmed ? true : undefined}
                  aria-describedby={errors.confirmed ? "quotation-confirm-error" : undefined}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>{t.answer.statement}</span>
              </label>
              {errors.confirmed && (
                <p id="quotation-confirm-error" className="field-error">
                  {errors.confirmed}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" icon="arrowRight" loading={sending === "accept"} loadingLabel={t.answer.sending} disabled={sending === "decline"}>
                {t.answer.accept}
              </Button>
              <Button type="button" variant="secondary" loading={sending === "decline"} loadingLabel={t.answer.sending} disabled={sending === "accept"} onClick={(event) => void send("decline", event as unknown as FormEvent)}>
                {t.answer.decline}
              </Button>
            </div>
            <p className="text-xs text-fg-subtle">{t.answer.nothingSent}</p>
          </form>
        </section>
      )}
    </div>
  );
}
