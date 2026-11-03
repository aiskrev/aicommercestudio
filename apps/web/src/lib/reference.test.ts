import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { decideRoute } from "@/lib/locale-routing";
import {
  INTEGRATION_STATUSES,
  PATTERNS,
  PATTERN_KEYS,
  PATTERN_SLUGS,
  SCENARIOS,
  SCENARIO_CATEGORIES,
  SCENARIO_KEYS,
  SCENARIO_SLUGS,
  patternBySlug,
  scenarioBySlug,
  scenariosIn,
  scenariosUsing,
  searchPatterns,
} from "@/lib/reference";
import { routes } from "@/lib/routes";
import { TOOLS } from "@/lib/tools";

const LOCALES = ["bg", "en"] as const;

describe("reference scenarios", () => {
  it("has 20 scenarios covering every requested topic, each in a category", () => {
    expect(SCENARIOS).toHaveLength(20);
    const topics = [
      "ai_invoice_workflow", "multi_agent_service", "rag_policy_assistant", "document_intelligence", "commerce_erp_sync",
      "catalog_enrichment", "ai_support_handoff", "azure_landing_zone", "aws_landing_zone", "kubernetes_platform",
      "gitops_delivery", "observability_otel", "cloud_migration", "hybrid_integration", "identity_secrets",
      "finops_ai_costs", "ai_operations", "data_pipeline", "platform_reliability",
    ];
    for (const topic of topics) expect(SCENARIO_KEYS).toContain(topic);
    for (const category of SCENARIO_CATEGORIES) expect(scenariosIn(category).length).toBeGreaterThan(0);
    expect(SCENARIO_CATEGORIES.flatMap(scenariosIn).sort()).toEqual([...SCENARIO_KEYS].sort());
  });

  it("every scenario has every required section, with the same structure in both languages", () => {
    const fields = ["problem", "assumptions", "constraints", "stages", "interfaces", "dataFlow", "security", "approvals", "phases", "limitations", "tradeoffs"] as const;
    for (const key of SCENARIO_KEYS) {
      const [bg, en] = LOCALES.map((l) => getContent(l).reference.scenarioTexts[key]);
      for (const field of fields) {
        for (const text of [bg, en]) expect(text[field], `${key}.${field}`).toBeTruthy();
        if (Array.isArray(bg[field])) {
          expect((en[field] as unknown[]).length, `${key}.${field}`).toBe((bg[field] as unknown[]).length);
          expect((bg[field] as unknown[]).length, `${key}.${field}`).toBeGreaterThan(0);
        }
      }
      expect(en.stages.map((s) => s.items.length)).toEqual(bg.stages.map((s) => s.items.length));
    }
  });

  it("is clearly labelled fictional and claims no clients, certifications or measured results", () => {
    for (const locale of LOCALES) {
      const r = getContent(locale).reference;
      expect(r.scenarios.fictionalNotice).toMatch(locale === "bg" ? /измислени/ : /fictional/);
      expect(r.scenarios.detail.fictionalLabel).toBeTruthy();
      for (const key of SCENARIO_KEYS) {
        const s = r.scenarioTexts[key];
        expect(s.problem, key).toMatch(locale === "bg" ? /Измислен/ : /A fictional/);
        const text = JSON.stringify(s);
        expect(text, key).not.toMatch(/\d+\s?%|€|\$\d|лв\.|case study|our client|нашия клиент|we delivered|внедрихме/i);
      }
    }
  });

  it("links only to existing assessments and patterns", () => {
    const toolKeys = new Set(TOOLS.map((t) => t.key));
    for (const s of SCENARIOS) {
      for (const a of s.assessments) expect(toolKeys.has(a), `${s.key} → ${a}`).toBe(true);
      for (const p of s.patterns) expect(PATTERN_KEYS).toContain(p);
      expect(s.domains.length).toBeGreaterThan(0);
    }
  });
});

describe("integration patterns", () => {
  it("covers the requested patterns, each with every section in both languages", () => {
    for (const key of ["rest_webhooks", "event_driven", "erp_crm_sync", "rag_ingestion", "human_approval", "landing_zone", "terraform_gitops", "kubernetes_platform", "opentelemetry", "identity_secrets"]) {
      expect(PATTERN_KEYS).toContain(key);
    }
    const fields = ["description", "whenToUse", "whenNotToUse", "stages", "prerequisites", "securityControls", "failureModes", "observability", "statusNote"] as const;
    for (const key of PATTERN_KEYS) {
      const [bg, en] = LOCALES.map((l) => getContent(l).reference.patternTexts[key]);
      for (const field of fields) {
        expect(bg[field], `${key}.${field}`).toBeTruthy();
        expect(en[field], `${key}.${field}`).toBeTruthy();
        if (Array.isArray(bg[field])) expect((en[field] as unknown[]).length).toBe((bg[field] as unknown[]).length);
      }
    }
  });

  it("states an honest integration status and claims no configured or certified connector", () => {
    for (const p of PATTERNS) expect(INTEGRATION_STATUSES).toContain(p.status);
    expect(PATTERNS.filter((p) => p.status === "configured")).toEqual([]);
    for (const locale of LOCALES) {
      const r = getContent(locale).reference.patterns;
      for (const status of INTEGRATION_STATUSES) expect(r.statuses[status].label).toBeTruthy();
      for (const key of PATTERN_KEYS) {
        expect(JSON.stringify(getContent(locale).reference.patternTexts[key])).not.toMatch(/production-certified|certified connector|сертифициран конектор/i);
      }
    }
  });

  it("every pattern is used by at least one scenario (reverse links)", () => {
    for (const key of PATTERN_KEYS) expect(scenariosUsing(key).length, key).toBeGreaterThan(0);
  });

  it("searches titles and summaries case-insensitively in catalogue order", () => {
    const en = getContent("en").reference.patternTexts;
    const text = (key: (typeof PATTERN_KEYS)[number]) => `${en[key].title} ${en[key].summary}`;
    expect(searchPatterns("", text)).toEqual(PATTERN_KEYS);
    expect(searchPatterns("  KUBERNETES ", text)).toEqual(["kubernetes_platform"]);
    expect(searchPatterns("zzz", text)).toEqual([]);
  });
});

describe("reference routes", () => {
  it("has unique URL-safe slugs that resolve back", () => {
    for (const [slugs, resolve] of [[SCENARIO_SLUGS, scenarioBySlug], [PATTERN_SLUGS, patternBySlug]] as const) {
      for (const locale of LOCALES) {
        const values = Object.values(slugs).map((s) => s[locale]);
        expect(new Set(values).size).toBe(values.length);
        for (const slug of values) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
      for (const [key, slug] of Object.entries(slugs)) {
        expect(resolve(slug.bg)).toBe(key);
        // Identical slugs would make the English URL redirect to itself.
        expect(slug.bg, key).not.toBe(slug.en);
      }
    }
    expect(scenarioBySlug("unknown")).toBeNull();
  });

  it("localizes index and detail URLs", () => {
    expect(localizePath("bg", routes.scenarios)).toBe("/bg/referentni-stsenarii");
    expect(localizePath("en", routes.scenarios)).toBe("/en/reference-scenarios");
    expect(localizePath("en", routes.scenario(SCENARIO_SLUGS.azure_landing_zone.bg))).toBe("/en/reference-scenarios/azure-landing-zone");
    expect(localizePath("en", routes.pattern(PATTERN_SLUGS.event_driven.bg))).toBe("/en/integration-patterns/event-driven-integration");
    expect(localizePath("bg", routes.pattern(PATTERN_SLUGS.event_driven.bg))).toBe("/bg/integratsionni-modeli/integratsiya-chrez-sabitiya");
  });

  it("serves the client portal outside the locale routing", () => {
    expect(decideRoute("/portal", false, null, "")).toEqual({ type: "next" });
    expect(decideRoute("/portal/activate", false, null, "")).toEqual({ type: "next" });
  });
});
