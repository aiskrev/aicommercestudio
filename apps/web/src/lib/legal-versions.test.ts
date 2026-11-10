import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { engineeringTool as bgEngineering } from "@/content/bg/tool-engineering";
import { solutionTool as bgSolution } from "@/content/bg/tool-solution";
import { engineeringTool as enEngineering } from "@/content/en/tool-engineering";
import { solutionTool as enSolution } from "@/content/en/tool-solution";
import { readinessTool as bgReadiness } from "@/content/bg/tool-readiness";
import { teamTool as bgTeam } from "@/content/bg/tool-team";
import { readinessTool as enReadiness } from "@/content/en/tool-readiness";
import { teamTool as enTeam } from "@/content/en/tool-team";
import {
  cookiePolicy as bgCookies,
  privacyPolicy as bgPrivacy,
  subscriptionTerms as bgSubscription,
  termsOfUse as bgTerms,
  withdrawalInfo as bgWithdrawal,
} from "@/content/bg/legal";
import {
  cookiePolicy as enCookies,
  privacyPolicy as enPrivacy,
  subscriptionTerms as enSubscription,
  termsOfUse as enTerms,
  withdrawalInfo as enWithdrawal,
} from "@/content/en/legal";
import { accountTexts } from "@/i18n/account";
import { billingTexts } from "@/i18n/billing";
import { bg } from "@/i18n/dictionaries/bg";
import { en } from "@/i18n/dictionaries/en";
import { LEGAL_DOCUMENT_KEYS, legalRegistry, type LegalDocumentKey } from "@/lib/legal-versions";

/**
 * A legal text or consent wording may not change without being accounted for: the id stored with every consent, order
 * acceptance and acknowledgement must identify the exact words that were shown.
 *
 * Revisions (docs/LEGAL_CONTENT_RELEASE.md):
 *   draft      the text is a working draft and may change under the same id; its hashes follow the text. It must
 *              say `pending_lawyer_review` and can never back a live contractual acceptance.
 *   approved   a lawyer signed this exact Bulgarian and English text off. `approved_content_sha256` holds its hash;
 *              from now on ANY change needs a new version id (and a new review), which this test enforces.
 *   published  approved and live under that id. Acceptances are recorded against the id; old ones stay readable.
 *
 * The Bulgarian and the English text have separate hashes (`content_sha256_bg`, `content_sha256_en`) and a combined
 * one (`content_sha256`), so a mix-up of languages, or a change to one language only, is visible.
 *
 * To refresh the hashes of DRAFT texts: UPDATE_LEGAL_VERSIONS=1 npx vitest run src/lib/legal-versions.test.ts,
 * then copy the file to apps/api/app/legal_versions.json (scripts/test.ps1 checks that the two are identical).
 */
const FILE = resolve(__dirname, "legal-versions.json");

type Texts = { bg: unknown; en: unknown };

const SOURCES: Record<LegalDocumentKey, () => Texts> = {
  privacy: () => ({ bg: bgPrivacy, en: enPrivacy }),
  cookies: () => ({ bg: bgCookies, en: enCookies }),
  terms: () => ({ bg: bgTerms, en: enTerms }),
  subscription_terms: () => ({ bg: bgSubscription, en: enSubscription }),
  withdrawal_info: () => ({ bg: bgWithdrawal, en: enWithdrawal }),
  // The same sentence is shown in the contact form, the readiness and team tools and the account pages.
  marketing_consent: () => ({
    bg: [
      bg.form.marketing,
      bgReadiness.send.marketing,
      bgTeam.consult.marketing,
      bgEngineering.consultation.marketing,
      bgSolution.enquiry.marketing,
      accountTexts.bg.register.marketing,
      accountTexts.bg.home.marketing,
    ],
    en: [
      en.form.marketing,
      enReadiness.send.marketing,
      enTeam.consult.marketing,
      enEngineering.consultation.marketing,
      enSolution.enquiry.marketing,
      accountTexts.en.register.marketing,
      accountTexts.en.home.marketing,
    ],
  }),
  order_acceptance: () => {
    const pick = (locale: "bg" | "en") => {
      const r = billingTexts[locale].review;
      return [r.termsPrefix, r.termsLink, r.termsMiddle, r.subscriptionLink, r.termsSuffix, r.submit];
    };
    return { bg: pick("bg"), en: pick("en") };
  },
  early_start: () => ({ bg: billingTexts.bg.review.earlyStart, en: billingTexts.en.review.earlyStart }),
};

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digest = (key: LegalDocumentKey) => sha([SOURCES[key]().bg, SOURCES[key]().en]);
const digestFor = (key: LegalDocumentKey, locale: "bg" | "en") => sha(SOURCES[key]()[locale]);

type Raw = { documents: Record<string, Record<string, unknown>> };

describe("legal document versions", () => {
  it("covers every document key", () => {
    expect(Object.keys(legalRegistry).sort()).toEqual([...LEGAL_DOCUMENT_KEYS].sort());
    expect(Object.keys(SOURCES).sort()).toEqual([...LEGAL_DOCUMENT_KEYS].sort());
  });

  it("uses a date id, an explicit revision status and an honest review status", () => {
    for (const key of LEGAL_DOCUMENT_KEYS) {
      const entry = legalRegistry[key];
      expect(entry.version).toMatch(/^\d{4}-\d{2}-\d{2}(-\d+)?$/);
      expect(["reviewed", "pending_lawyer_review"]).toContain(entry.review);
      expect(["draft", "approved", "published"]).toContain(entry.status);
      // A draft is never "reviewed", and an approved or published text is never "pending".
      expect(entry.review === "reviewed").toBe(entry.status !== "draft");
    }
  });

  it("pairs the two languages explicitly and never shares a hash between them", () => {
    for (const key of LEGAL_DOCUMENT_KEYS) {
      expect(legalRegistry[key].languages).toEqual(["bg", "en"]);
      expect(digestFor(key, "bg")).not.toBe(digestFor(key, "en"));
    }
  });

  it("changes a draft's hashes whenever a text changes", () => {
    if (process.env.UPDATE_LEGAL_VERSIONS) {
      const file = JSON.parse(readFileSync(FILE, "utf-8")) as Raw;
      for (const key of LEGAL_DOCUMENT_KEYS) {
        const entry = file.documents[key];
        if ((entry.status ?? "draft") !== "draft") continue; // an approved text never gets new hashes under the same id
        entry.status = "draft";
        entry.languages = ["bg", "en"];
        entry.content_sha256 = digest(key);
        entry.content_sha256_bg = digestFor(key, "bg");
        entry.content_sha256_en = digestFor(key, "en");
        entry.approved_content_sha256 ??= null;
      }
      writeFileSync(FILE, JSON.stringify(file, null, 2) + "\n");
    }
    const stale = LEGAL_DOCUMENT_KEYS.filter(
      (key) =>
        legalRegistry[key].content_sha256 !== digest(key) ||
        legalRegistry[key].content_sha256_bg !== digestFor(key, "bg") ||
        legalRegistry[key].content_sha256_en !== digestFor(key, "en"),
    );
    expect(
      stale,
      "These texts changed. For a draft, run with UPDATE_LEGAL_VERSIONS=1. For an approved text, bump the version id and get a new review.",
    ).toEqual([]);
  });

  it("freezes an approved or published text: it must still match what the lawyer signed off", () => {
    for (const key of LEGAL_DOCUMENT_KEYS) {
      const entry = legalRegistry[key];
      if (entry.status === "draft") {
        expect(entry.approved_content_sha256, `${key}: a draft has no approved hash`).toBeNull();
      } else {
        expect(entry.approved_content_sha256, `${key}: approved text changed under the same version id`).toBe(digest(key));
      }
    }
  });

  it("does not describe a draft text as approved or certified", () => {
    for (const key of ["privacy", "cookies", "terms", "subscription_terms", "withdrawal_info"] as const) {
      const text = JSON.stringify(SOURCES[key]());
      if (legalRegistry[key].status === "draft") expect(text).not.toMatch(/одобрен от юрист|approved by a lawyer|certified/i);
    }
  });
});
