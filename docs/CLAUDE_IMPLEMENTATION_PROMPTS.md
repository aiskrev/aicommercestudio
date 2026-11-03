# Implementation prompts for AI coding agents

Status: compiled on 2026-11-03. This file explains how implementation work on this repository is
briefed to an AI coding agent (Claude Code) and lists which prompt packages have shipped. The
standing rules themselves are in [`CLAUDE.md`](../CLAUDE.md) at the repository root, which the agent
loads automatically and which wins over anything here. Phase-specific prompts live in
[`docs/prompts/`](prompts/).

## 1. Rules every prompt inherits (from CLAUDE.md)

1. **Protected content.** These are kept exactly as they are on every surface:
   * the founder portrait (`apps/web/src/assets/founder/aleksandar-iskrev.webp`, rendered only through
     `FounderPortrait`);
   * the public contact details (only through `lib/company.ts` and `ContactDetails`);
   * the founder profile;
   * the logo.

   `lib/protected-content.test.ts` and `lib/company.test.ts` fail if any of this disappears or is
   duplicated. A prompt that seems to require touching them stops and asks.
2. **No deploys, production pushes or production migrations** without explicit approval. Commit and
   push only when asked. No force-push.
3. **Never read or print credentials** from `.env`.
4. **No invented metrics, client results, prices, guarantees, articles, dates or credentials.**
   Unknown facts stay placeholders or "not connected" states.
5. **Both languages together.** BG is the reference. EN carries the same facts. BG and EN slugs of a
   page differ.

## 2. How a prompt package is structured

The packages that worked best have the same shape:

* **Role.** For example "Principal SaaS Security Architect".
* **FIRST.** What to inspect before changing anything (existing modules, tests, docs). The agent
  reuses what exists; PRODUCT_MODULES.md lists the modules to extend.
* **OBJECTIVE and IMPLEMENT.** The capability and its parts.
* **Constraints.** What must not be fabricated or enabled, and prerequisites that stop the work if
  unmet (e.g. "do not proceed if the restricted-role RLS tests fail").
* **TEST.** The behaviours to prove, at the right layer: pytest for API rules, Vitest for UI and
  content, Playwright for flows.
* **Documentation.** Which authoritative document to update. The agent extends existing documents
  rather than writing parallel copies (see the V2 document map in
  [INTEGRATION_AUDIT_V2.md](INTEGRATION_AUDIT_V2.md) §8).

Several packages may be sent together with a closing instruction such as "do everything, then test,
commit, push and open a PR". The agent then:

1. implements the packages on one branch;
2. runs every suite (`scripts/test.ps1` and the Playwright run);
3. reports the exact results;
4. opens one pull request.

It never merges or deploys.

## 3. Working commands (Windows host, Docker)

| Purpose | Command |
| --- | --- |
| API tests, Ruff, docs sync | `.\scripts\test.ps1 -Suite api` |
| Web typecheck, ESLint, Vitest | `.\scripts\test.ps1 -Suite web` |
| End-to-end (Playwright) | `.\scripts\test.ps1 -Suite e2e` |
| Dependency audits | `.\scripts\test.ps1 -Suite audit` |
| Regenerate `docs/openapi.json` | `docker compose --profile test run --rm --build --no-deps -T -v "<repo>:/repo" api-tests python scripts/docs_sync.py --write` |
| Format only the touched Python files | `ruff format <paths>` inside `api-tests` (formatting the whole tree rewrites unrelated files) |

Things that have tripped agents up before:

* Write files that contain Cyrillic with an editor tool, not a shell heredoc.
* Pass absolute paths to Docker bind mounts.
* Remember the contact form's per-IP rate limit in e2e (one `X-Forwarded-For` per spec).
* Wait for each admin tab's own test id before using its controls.

## 4. Prompt packages that have shipped

The pull requests are in `aiskrev/aicommercestudio`. Each title is the PR's own.

| PR | Merged | Package |
| --- | --- | --- |
| #1–#4 | 2026-10-24 | Premium UI redesign, editorial redesign, CI and Lighthouse baseline, logo restored |
| #5–#16 | 2026-10-27 | Tools hub, readiness reports, AI team builder, ROI and Finder, Solution Builder and agent library, AI Managed Services upgrade and Ops foundation, release review |
| #17–#21 | 2026-10-27 | Baseline audit, platform vision and taxonomy, UI consolidation, IA v2, domain hubs |
| #22–#28 | 2026-10-28 | Service catalogue architecture, API and admin, founder profile, service discovery, navigation mega-menu, tools hub v2 |
| #29–#34 | 2026-10-28 | Assessment engine, readiness 2026-11.1, tools depth, contact single source, Advisor V2 and reports, observability assessment |
| #35–#37 | 2026-11-03 | The remaining engineering assessments and one results experience |
| #38 | 2026-11-03 | AI Solution Builder + agent library v2; AI Managed Services v2 |
| #39 | 2026-11-03 | Ops platform: RLS hardening, registry, evaluations, observability, incidents and changes, client portal (off); reference scenarios and patterns |
| this branch | — | Workshops & Advisory catalogue and engineering insight topics; opportunity, proposal and SOW workflow; client portal browser e2e; integration and quality audit with the V2 document set |

## 5. Prompts not yet written

These follow from the open items in [INTEGRATION_AUDIT_V2.md](INTEGRATION_AUDIT_V2.md) and the
launch blockers there:

* a production deployment package (hosting decision first, IMPLEMENTATION_DEPENDENCIES_V2 §4);
* a separate runtime login role;
* staff MFA;
* transactional e-mail behind an approval policy;
* the first real engineering articles (C-5), written by a named author.
