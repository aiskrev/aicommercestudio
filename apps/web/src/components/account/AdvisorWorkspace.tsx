"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import { BUSINESS_TYPES, MONTHLY_VOLUMES, TEAM_SIZES } from "@/content/bg/advisor";
import { advisor as bgAdvisor } from "@/content/bg/advisor";
import { advisor as enAdvisor } from "@/content/en/advisor";
import { type Locale, localizePath } from "@/i18n/config";
import { workspaceTexts } from "@/i18n/workspace";
import { AccountError, workspaceFetch } from "@/lib/account-api";
import { routes } from "@/lib/routes";

type Me = {
  plan: string;
  features: string[];
  limits: Record<string, number>;
  usage: Record<string, { used: number; reserved: number }>;
};
type Project = { id: string; name: string };
type Version = {
  number: number;
  label: string | null;
  result_kind: "template" | "ai_model";
  model: string;
  preview: string;
  complexity: string;
  locked: boolean;
  disclaimer: string;
};

type Section = { left_count: number; right_count: number };
type Comparison = {
  complexity: { left: string; right: string };
  sections: Record<string, Section>;
};

/** Plan, projects and versions. This view only follows the plan: the API checks every right itself. */
export function AdvisorWorkspace({ locale }: { locale: Locale }) {
  const t = workspaceTexts[locale];
  const options = (locale === "bg" ? bgAdvisor : enAdvisor).options;
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [current, setCurrent] = useState<Project | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  const api = useCallback(
    <T,>(path: string, method = "GET", body?: unknown, headers?: Record<string, string>) =>
      workspaceFetch<T>(path, locale, t.network, { method, body, headers }),
    [locale, t.network],
  );

  const fail = useCallback(
    (reason: unknown) => {
      if (reason instanceof AccountError && reason.status === 401) {
        router.replace(localizePath(locale, routes.accountSignIn));
        return;
      }
      setError(reason instanceof Error ? reason.message : t.network);
    },
    [locale, router, t.network],
  );

  const load = useCallback(async () => {
    try {
      const [state, list] = await Promise.all([api<Me>("/me"), api<Project[]>("/projects")]);
      setMe(state);
      setProjects(list);
    } catch (reason) {
      fail(reason);
    }
  }, [api, fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function open(project: Project) {
    setError(null);
    try {
      setVersions(await api<Version[]>(`/projects/${project.id}/versions`));
      setCurrent(project);
    } catch (reason) {
      fail(reason);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    setError(null);
    try {
      await api("/projects", "POST", { name });
      form.reset();
      await load();
    } catch (reason) {
      fail(reason);
    }
  }

  async function runAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(
        `/projects/${current.id}/versions`,
        "POST",
        {
          engine: data.get("engine"),
          business_type: data.get("business_type"),
          monthly_volume: data.get("monthly_volume"),
          team_size: data.get("team_size"),
          process_description: data.get("process_description"),
          label: String(data.get("label") ?? "") || null,
          locale,
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      await open(current);
      await load();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function followUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await api(
        `/projects/${current.id}/versions`,
        "POST",
        {
          engine: data.get("engine"),
          parent_number: Number(data.get("parent_number")),
          clarification: data.get("clarification"),
          locale,
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      form.reset();
      await open(current);
      await load();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }

  async function compareVersions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const data = new FormData(event.currentTarget);
    setError(null);
    try {
      const query = new URLSearchParams({ left: String(data.get("left")), right: String(data.get("right")) });
      setComparison(await api<Comparison>(`/projects/${current.id}/compare?${query.toString()}`));
    } catch (reason) {
      fail(reason);
    }
  }

  if (!me) return error ? <Alert tone="error">{error}</Alert> : <p>{t.loading}</p>;
  const canUseAi = me.features.includes("ai_assessments");
  const canExport = me.features.includes("export_markdown");
  const canFollowUp = me.features.includes("follow_ups") && versions.length > 0;
  const canCompare = me.features.includes("compare") && versions.length > 1;
  const numbers = versions.map((version) => version.number);
  const aiUsed = me.usage.limit_ai_runs_month?.used ?? 0;

  return (
    <div className="max-w-3xl space-y-8">
      {error && (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      )}
      <p className="text-sm">
        {t.plan}: <strong>{t.plans[me.plan as keyof typeof t.plans] ?? me.plan}</strong> · {t.aiUsage}: {aiUsed} /{" "}
        {me.limits.limit_ai_runs_month ?? 0}
      </p>

      {!current && (
        <section aria-labelledby="workspace-projects" className="space-y-4">
          <h2 id="workspace-projects" className="text-xl font-semibold">
            {t.projects}
          </h2>
          {projects.length === 0 && <p className="text-sm">{t.noProjects}</p>}
          <ul className="space-y-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Button type="button" variant="secondary" onClick={() => void open(project)}>
                  {project.name}
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={createProject} className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="workspace-name" className="field-label">
                {t.projectName}
              </label>
              <input id="workspace-name" name="name" className="field" required minLength={2} maxLength={120} />
            </div>
            <Button type="submit">{t.createProject}</Button>
          </form>
        </section>
      )}

      {current && (
        <section aria-labelledby="workspace-project" className="space-y-6">
          <Button type="button" variant="secondary" size="sm" onClick={() => setCurrent(null)}>
            {t.back}
          </Button>
          <h2 id="workspace-project" className="text-xl font-semibold">
            {current.name}
          </h2>
          <ul className="space-y-4">
            {versions.map((version) => (
              <li key={version.number} className="space-y-1 text-sm" data-testid="workspace-version">
                <p>
                  <strong>
                    {t.version} {version.number}
                    {version.label ? `: ${version.label}` : ""}
                  </strong>
                </p>
                <p>{version.result_kind === "ai_model" ? `${t.aiResult} (${version.model})` : t.templateResult}</p>
                <p>{version.preview}</p>
                {version.locked && <p>{t.locked}</p>}
                {canExport && !version.locked && (
                  <a href={`/api/workspace/projects/${current.id}/versions/${version.number}/export`}>{t.export}</a>
                )}
              </li>
            ))}
          </ul>
          {canCompare && (
            <form onSubmit={compareVersions} className="flex flex-wrap items-end gap-3">
              {(["left", "right"] as const).map((side, index) => (
                <div key={side}>
                  <label htmlFor={`workspace-${side}`} className="field-label">
                    {t.version}
                  </label>
                  <select
                    id={`workspace-${side}`}
                    name={side}
                    className="field"
                    defaultValue={numbers[numbers.length - 2 + index]}
                  >
                    {numbers.map((number) => (
                      <option key={number} value={number}>
                        {number}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <Button type="submit" variant="secondary">
                {t.compare}
              </Button>
            </form>
          )}
          {comparison && (
            <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm" data-testid="workspace-comparison">
              <dt>{t.complexity}</dt>
              <dd>{comparison.complexity.left}</dd>
              <dd>{comparison.complexity.right}</dd>
              {Object.entries(comparison.sections).map(([name, section]) => (
                <div key={name} className="contents">
                  <dt>{t.sections[name as keyof typeof t.sections] ?? name}</dt>
                  <dd>{section.left_count}</dd>
                  <dd>{section.right_count}</dd>
                </div>
              ))}
            </dl>
          )}
          {canFollowUp && (
            <form onSubmit={followUp} className="space-y-4">
              <h3 className="font-semibold">{t.followUp}</h3>
              <input type="hidden" name="parent_number" value={numbers[numbers.length - 1]} />
              <input type="hidden" name="engine" value="template" />
              <div>
                <label htmlFor="workspace-clarification" className="field-label">
                  {t.clarification}
                </label>
                <textarea
                  id="workspace-clarification"
                  name="clarification"
                  className="field"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={1000}
                />
              </div>
              <Button type="submit" variant="secondary" loading={busy} loadingLabel={t.loading}>
                {t.followUpSubmit}
              </Button>
            </form>
          )}
          <form onSubmit={runAssessment} className="space-y-4">
            <h3 className="font-semibold">{t.newAssessment}</h3>
            <div>
              <label htmlFor="workspace-engine" className="field-label">
                {t.engine}
              </label>
              <select id="workspace-engine" name="engine" className="field" defaultValue="template">
                <option value="template">{t.templateResult}</option>
                {canUseAi && <option value="ai">{t.aiResult}</option>}
              </select>
            </div>
            <div>
              <label htmlFor="workspace-business" className="field-label">
                {t.businessType}
              </label>
              <select id="workspace-business" name="business_type" className="field" required>
                {BUSINESS_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {options.businessTypes[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="workspace-volume" className="field-label">
                {t.volume}
              </label>
              <select id="workspace-volume" name="monthly_volume" className="field" required>
                {MONTHLY_VOLUMES.map((value) => (
                  <option key={value} value={value}>
                    {options.volumes[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="workspace-team" className="field-label">
                {t.team}
              </label>
              <select id="workspace-team" name="team_size" className="field" required>
                {TEAM_SIZES.map((value) => (
                  <option key={value} value={value}>
                    {options.teams[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="workspace-description" className="field-label">
                {t.description}
              </label>
              <textarea
                id="workspace-description"
                name="process_description"
                className="field"
                rows={5}
                required
                minLength={40}
                maxLength={2000}
              />
            </div>
            <div>
              <label htmlFor="workspace-label" className="field-label">
                {t.label}
              </label>
              <input id="workspace-label" name="label" className="field" maxLength={80} />
            </div>
            <Button type="submit" loading={busy} loadingLabel={t.loading}>
              {t.run}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
