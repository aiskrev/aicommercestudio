import { getContent } from "@/content";
import { locales } from "@/i18n/config";

/**
 * Texts the API needs for the AI team PDF plan, taken from the same content the UI renders, so the
 * two never drift. Snapshot: src/lib/team-texts.json (checked by team-texts.test.ts) and its copy
 * apps/api/app/team/texts.json (scripts/test.ps1 checks both are identical).
 * Regenerate after changing content/{bg,en}/tool-team.ts:
 *   docker compose --profile test run --rm -e UPDATE_TEAM_TEXTS=1 -v "${PWD}/apps/web/src:/app/src" web-tests npx vitest run src/lib/team-texts.test.ts
 * then copy src/lib/team-texts.json to apps/api/app/team/texts.json.
 */
export function teamTextsSnapshot() {
  return Object.fromEntries(
    locales.map((locale) => {
      const t = getContent(locale).teamTool;
      return [
        locale,
        {
          title: t.title,
          context: {
            industry: t.context.industry,
            size: t.context.size,
            leadDepartment: t.context.leadDepartment,
            challenge: t.context.challenge,
            volume: { label: t.context.volume.label, options: t.context.volume.options },
          },
          departments: { label: t.departments.label, options: t.departments.options },
          agents: Object.fromEntries(
            Object.entries(t.agents).map(([key, a]) => [key, { name: a.name, short: a.short, purpose: a.purpose, oversight: a.oversight }]),
          ),
          integrations: t.integrations,
          checkpoints: t.checkpoints,
          complexity: t.complexity,
          deployment: t.teamStep.deployment,
          operations: t.teamStep.operations,
          architecture: { title: t.architecture.title, lanes: t.architecture.lanes, nodes: t.architecture.nodes },
          result: t.result,
          costs: t.costs,
          security: t.security,
          dataFlows: t.dataFlows,
          hitlTitle: t.hitlTitle,
          hitlNone: t.hitlNone,
        },
      ];
    }),
  );
}
