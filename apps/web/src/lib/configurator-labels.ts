import { getContent, serviceByKey } from "@/content";
import { locales } from "@/i18n/config";
import { CARE_PLANS } from "@/lib/care-plans";
import { CONFIGURATOR_MODEL_VERSION } from "@/lib/configurator";
import { PROJECT_PACKAGES } from "@/lib/project-packages";
import { WORKSHOP_KEYS } from "@/lib/workshop-slugs";

/**
 * The words behind the configurator's keys, as one document for the API.
 *
 * The API evaluates configurations with keys only. When staff generate a first proposal draft from a configured
 * enquiry (apps/api/app/opportunities/configured.py), the draft needs the same wording the visitor saw: package
 * names and scopes, feature names, what needs an assessment. This snapshot is generated from the site content into
 * lib/configurator-labels.json and copied to apps/api/app/configurator/labels.json (scripts/test.ps1 compares the
 * two). It carries no amount. Regenerate with UPDATE_CONFIGURATOR_LABELS=1.
 */
export function configuratorLabelsSnapshot() {
  const perLocale = Object.fromEntries(
    locales.map((locale) => {
      const content = getContent(locale);
      const c = content.configurator;
      const q = c.questions;
      const optionLabels = (options: Record<string, string | { label: string }>) =>
        Object.fromEntries(Object.entries(options).map(([key, value]) => [key, typeof value === "string" ? value : value.label]));
      return [
        locale,
        {
          packages: Object.fromEntries(
            PROJECT_PACKAGES.map((definition) => {
              const text = content.projectPackages.packages[definition.key];
              return [
                definition.key,
                {
                  name: text.name,
                  objective: text.objective,
                  includes: text.includes,
                  excludes: text.excludes,
                  prerequisites: text.prerequisites,
                  stages: serviceByKey(locale, definition.service).workflow.map((step) => step.title),
                },
              ];
            }),
          ),
          delivery: c.review.delivery,
          questions: {
            project_type: optionLabels(q.project_type.options),
            pages: optionLabels(q.pages.options),
            products: optionLabels(q.products.options),
            languages: optionLabels(q.languages.options),
            build: optionLabels(q.build.options),
            branding: optionLabels(q.branding.options),
            design_level: optionLabels(q.design_level.options),
          },
          flags: {
            content_migration: q.content_migration,
            store_migration: q.store_migration,
            accessibility: q.accessibility,
            interactive_elements: q.interactive_elements,
          },
          features: q.features.options,
          operations: q.operations.options,
          unpriced: c.review.unpricedLabels,
          assumptions: c.review.assumptionLabels,
          exclusions: c.review.exclusionLabels,
          offers: {
            service: Object.fromEntries(content.services.map((service) => [service.key, service.shortTitle])),
            care_plan: Object.fromEntries(CARE_PLANS.map((plan) => [plan.key, content.carePlans.plans[plan.key].name])),
            ai_managed: Object.fromEntries(content.aiManaged.packages.items.map((item) => [item.key, item.name])),
            workshop: Object.fromEntries(WORKSHOP_KEYS.map((key) => [key, content.workshops.texts[key].title])),
          },
        },
      ];
    }),
  );
  return { version: CONFIGURATOR_MODEL_VERSION, ...perLocale };
}
