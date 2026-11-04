"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import { type Locale, localizePath } from "@/i18n/config";
import { zoneTexts } from "@/i18n/zone";
import { AccountError, zoneFetch } from "@/lib/account-api";
import { routes } from "@/lib/routes";

type Texts = (typeof zoneTexts)[Locale];
type Overview = {
  role: string;
  plan: string;
  projects: number;
  open_requests: number;
  usage: Record<string, { used: number; reserved: number }>;
  limits: Record<string, number>;
};
type Document = {
  id: string;
  kind: "proforma" | "invoice" | "credit_note";
  status: "queued" | "issued" | "failed" | "blocked";
  number: string | null;
  demo: boolean;
  amount_minor: number;
  currency: string;
  created_at: string;
};
type Member = { id: string; email: string; role: string };
type Request = { id: string; kind: "software" | "service"; subject: string; status: string; created_at: string };
type Profile = {
  legal_name: string;
  company_id: string | null;
  vat_id: string | null;
  address: string;
  country: string;
  email: string;
};

/** Loads one API path; a sign-in problem goes to the sign-in page, a refused role shows a message. */
function useZone<T>(path: string, locale: Locale) {
  const t = zoneTexts[locale];
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await zoneFetch<T>(path, locale, t.network));
    } catch (reason) {
      if (reason instanceof AccountError && reason.status === 401) {
        router.replace(localizePath(locale, routes.accountSignIn));
        return;
      }
      setError(reason instanceof Error ? reason.message : t.network);
    }
  }, [path, locale, router, t.network]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { data, error, load, setError };
}

function NoSource({ t, label }: { t: Texts; label: string }) {
  return (
    <div className="text-sm">
      <dt className="font-semibold">{label}</dt>
      <dd>{t.noSource}</dd>
    </div>
  );
}

function Failure({ text }: { text: string | null }) {
  return text ? (
    <Alert tone="error" role="alert">
      {text}
    </Alert>
  ) : null;
}

export function ZoneDashboard({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  const { data, error } = useZone<Overview>("/overview", locale);
  if (error) return <Failure text={error} />;
  if (!data) return <p>{t.loading}</p>;
  return (
    <dl className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="text-sm">
        <dt className="font-semibold">{t.plan}</dt>
        <dd className="capitalize">{data.plan}</dd>
      </div>
      <div className="text-sm">
        <dt className="font-semibold">{t.projects}</dt>
        <dd>{data.projects}</dd>
      </div>
      <div className="text-sm">
        <dt className="font-semibold">{t.openRequests}</dt>
        <dd>{data.open_requests}</dd>
      </div>
      <NoSource t={t} label={t.uptime} />
      <NoSource t={t} label={t.agentRuns} />
      <NoSource t={t} label={t.costs} />
    </dl>
  );
}

export function ZonePlan({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  const { data, error } = useZone<Overview>("/overview", locale);
  if (error) return <Failure text={error} />;
  if (!data) return <p>{t.loading}</p>;
  const rows: [string, string][] = [
    [t.templateRuns, "limit_template_runs_month"],
    [t.aiRuns, "limit_ai_runs_month"],
  ];
  return (
    <div className="max-w-2xl space-y-4 text-sm">
      <p>
        {t.plan}: <strong className="capitalize">{data.plan}</strong>
      </p>
      <ul className="space-y-1">
        {rows.map(([label, key]) => (
          <li key={key}>
            {label}: {data.usage[key]?.used ?? 0} / {data.limits[key] ?? 0}
          </li>
        ))}
      </ul>
      <p>{t.softwareNotService}</p>
    </div>
  );
}

function ProfileForm({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  const { data, error, setError } = useZone<Profile | null>("/billing-profile", locale);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setSaved(false);
    try {
      await zoneFetch("/billing-profile", locale, t.network, {
        method: "PUT",
        body: {
          legal_name: text("legal_name"),
          company_id: text("company_id") || null,
          vat_id: text("vat_id") || null,
          address: text("address"),
          country: text("country").toUpperCase(),
          email: text("email"),
        },
      });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.network);
    }
  }

  const fields: [keyof Profile, string, boolean][] = [
    ["legal_name", t.legalName, true],
    ["company_id", t.companyId, false],
    ["vat_id", t.vatId, false],
    ["address", t.address, true],
    ["country", t.country, true],
    ["email", t.invoiceEmail, true],
  ];
  return (
    <form key={data?.legal_name ?? "new"} onSubmit={save} className="max-w-md space-y-4">
      <h2 className="text-xl font-semibold">{t.profileTitle}</h2>
      <p className="text-sm">{t.profileNote}</p>
      <Failure text={error} />
      {saved && <Alert tone="success">{t.saved}</Alert>}
      {fields.map(([name, label, required]) => (
        <div key={name}>
          <label htmlFor={`zone-${name}`} className="field-label">
            {label}
          </label>
          <input
            id={`zone-${name}`}
            name={name}
            className="field"
            required={required}
            defaultValue={data?.[name] ?? ""}
            maxLength={name === "country" ? 2 : 300}
          />
        </div>
      ))}
      <Button type="submit">{t.save}</Button>
    </form>
  );
}

export function ZoneInvoices({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  const { data, error } = useZone<Document[]>("/documents", locale);
  if (error) return <Failure text={error} />;
  if (!data) return <p>{t.loading}</p>;
  return (
    <div className="max-w-2xl space-y-8">
      {data.length === 0 && <p className="text-sm">{t.noDocuments}</p>}
      <ul className="space-y-3">
        {data.map((row) => (
          <li key={row.id} className="text-sm" data-testid="zone-document">
            <strong>{t.kinds[row.kind]}</strong> {row.number ?? ""} · {(row.amount_minor / 100).toFixed(2)}{" "}
            {row.currency.toUpperCase()} · {t.statuses[row.status]}
            {row.demo ? ` · ${t.demo}` : ""}{" "}
            {row.status === "issued" && <a href={`/api/zone/documents/${row.id}/download`}>{t.download}</a>}
          </li>
        ))}
      </ul>
      {data.length > 0 && (
        // A file download from the API, not a page: next/link would try to route to it.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/api/zone/documents/export">{t.exportAll}</a>
      )}
      <ProfileForm locale={locale} />
    </div>
  );
}

export function ZoneSupport({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  const { data, error, load, setError } = useZone<Request[]>("/support", locale);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      await zoneFetch("/support", locale, t.network, {
        method: "POST",
        body: { kind: form.get("kind"), subject: form.get("subject"), message: form.get("message") },
      });
      target.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.network);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Failure text={error} />
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => (
          <li key={row.id}>
            {row.subject} · {t.requestKinds[row.kind]}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="space-y-4">
        <div>
          <label htmlFor="zone-kind" className="field-label">
            {t.requestKind}
          </label>
          <select id="zone-kind" name="kind" className="field">
            <option value="software">{t.requestKinds.software}</option>
            <option value="service">{t.requestKinds.service}</option>
          </select>
        </div>
        <div>
          <label htmlFor="zone-subject" className="field-label">
            {t.subject}
          </label>
          <input id="zone-subject" name="subject" className="field" required minLength={3} maxLength={160} />
        </div>
        <div>
          <label htmlFor="zone-message" className="field-label">
            {t.message}
          </label>
          <textarea id="zone-message" name="message" className="field" rows={5} required minLength={10} maxLength={4000} />
          <p className="field-hint">{t.noSecrets}</p>
        </div>
        <Button type="submit">{t.send}</Button>
      </form>
    </div>
  );
}

export function ZoneMembers({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  const { data, error, load, setError } = useZone<Member[]>("/members", locale);
  const [link, setLink] = useState<string | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const { token } = await zoneFetch<{ token: string }>("/invitations", locale, t.network, {
        method: "POST",
        body: { email: form.get("email"), role: form.get("role") },
      });
      setLink(`${window.location.origin}${localizePath(locale, routes.accountOrganisation)}#invite=${token}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.network);
    }
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    zoneFetch("/invitations/accept", locale, t.network, { method: "POST", body: { token } }).then(
      () => void load(),
      (reason: unknown) => setError(reason instanceof Error ? reason.message : t.network),
    );
  }, [load, locale, setError, t.network]);

  return (
    <div className="max-w-2xl space-y-6">
      <Failure text={error} />
      <ul className="space-y-1 text-sm">
        {(data ?? []).map((member) => (
          <li key={member.id}>
            {member.email} · {t.roles[member.role as keyof typeof t.roles]}
          </li>
        ))}
      </ul>
      <form onSubmit={invite} className="space-y-4">
        <h2 className="text-xl font-semibold">{t.inviteTitle}</h2>
        <div>
          <label htmlFor="zone-invite-email" className="field-label">
            {t.invoiceEmail}
          </label>
          <input id="zone-invite-email" name="email" type="email" className="field" required />
        </div>
        <div>
          <label htmlFor="zone-invite-role" className="field-label">
            {t.role}
          </label>
          <select id="zone-invite-role" name="role" className="field">
            <option value="member">{t.roles.member}</option>
            <option value="billing">{t.roles.billing}</option>
          </select>
        </div>
        <Button type="submit">{t.invite}</Button>
      </form>
      {link && (
        <Alert tone="info" role="status">
          {t.inviteLink} <span className="break-all">{link}</span>
        </Alert>
      )}
    </div>
  );
}

const SECTIONS = [
  ["dashboard", routes.account],
  ["projects", routes.accountAdvisor],
  ["plan", routes.accountPlan],
  ["subscriptions", routes.accountSubscriptions],
  ["invoices", routes.accountInvoices],
  ["support", routes.accountSupport],
  ["organisation", routes.accountOrganisation],
  ["security", routes.accountSecurity],
] as const;

export function ZoneNav({ locale }: { locale: Locale }) {
  const t = zoneTexts[locale];
  return (
    <nav aria-label={t.navLabel} className="mb-8">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {SECTIONS.map(([key, path]) => (
          <li key={key}>
            <Link href={localizePath(locale, path)}>{t.nav[key]}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
