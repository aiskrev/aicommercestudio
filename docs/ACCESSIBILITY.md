# Accessibility review of the legal flows

Status: **automated checks run; manual review NOT done. This is not a statement of WCAG conformance.** Automated tools
find only part of the problems. Treat every "PASS" below as "no serious or critical axe violation found", nothing more.

## What was run

* **axe-core (rules WCAG 2.0 and 2.1, levels A and AA)** through `@axe-core/playwright` 4.10.2 (a new small dev dependency of the
  e2e package) in `apps/web/e2e/tests/accessibility.spec.ts`. Violations of impact "serious" or "critical" fail the test;
  lesser ones and the "incomplete" list are attached to each test as `axe-<page>.json` and were not reviewed one by one.
* **Keyboard and status checks written by hand**: the contact consent controls (tab to each, space to toggle, error tied with
  `aria-invalid` and `aria-describedby`), the opt-out page (focus, Enter, result in a live region), the footer links, the order
  review (radio and checkbox by keyboard, focus ring, error), the data-rights form and its status message, the staff tabs.
* **Responsive capture** (`responsive-legal.spec.ts`): no horizontal overflow of the content at 375, 390, 768, 1024 and 1440 px,
  with a screenshot of every view attached to the run.

## Results (local Docker stack, desktop Chromium, 2026-11-10)

| Area | Automated axe | Keyboard / status | Notes |
| --- | --- | --- | --- |
| Legal pages, BG and EN (privacy, cookies, terms, subscription terms, withdrawal) | PASS | footer links PASS | one `h1` per page asserted |
| Contact form with the consent controls, BG and EN | PASS | PASS | privacy error is associated with the checkbox |
| Opt-out page (self-service marketing withdrawal) | PASS | PASS | result is in a `role="status"` region |
| Order review, terms acceptance, consumer/business, early start | PASS | PASS (radio, checkboxes, focus ring, error association) | account stack only |
| Withdrawal, both steps | PASS | exercised by the workflow specs | account stack only |
| Data rights and export | PASS | PASS (select reachable, status message announced) | account stack only |
| Staff queues | PASS | tabs operable | staff area |
| Footer links, BG and EN | n/a | PASS | |

**Not automated / manual review required:** screen-reader reading order and announcements (NVDA, VoiceOver, TalkBack),
colour contrast beyond what axe computes on the rendered page, focus management after the two withdrawal steps and after
errors, reading level and plain language of the legal text, zoom to 200 % and text spacing, reduced motion, touch target
sizes on real phones. No real device was used.

## Responsive and manual UX

| View | 375 | 390 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| Legal pages, contact form, footer, opt-out | Playwright capture (default stack, accounts off); also inspected by the agent in a browser (withdrawal page at 375; contact page overflow at 390, 768, 1024, 1440); no human review | capture | capture | capture | capture |
| Order review, withdrawal steps, data rights, staff queues | Playwright capture (accounts stack); **not manually inspected** | same | same | same | same |

**Update 2026-11-11: BLOCKER-ACC-HEADER-01 is closed.** The desktop bar now shows one compact sign-in control instead of
a text link plus a sign-up button, the header fits at 1024 and 1440 px with accounts on, and the test below runs without
`test.fail()`. The original finding is kept for the record.

**Known defect (as found), not caused by this work (found by the capture), release blocker BLOCKER-ACC-HEADER-01:** with customer accounts switched on, the Bulgarian site
header is wider than the screen at 1024 px (about 14 px) and at 1440 px (about 150 px), because the sign-in and sign-up links
were added to an already full bar. It is invisible while accounts are off (the production state) and must be fixed — a design
decision about which links move into the menu — before accounts are switched on. `responsive-legal.spec.ts` keeps a
`test.fail()` marker that turns red when the header is fixed.

**Withdrawal and the shared request limit (fixed 2026-11-11):** the withdrawal routes no longer count against the plan's shared per-workspace request limit; they have dedicated limits per workspace and per account that answer 429 with `Retry-After`. A repeat for a contract with an open request returns that request without using any limit. If the withdrawal data cannot load for any reason other than "billing is off", the section stays visible with the retry time and the e-mail alternative, and the plan list failing no longer hides it.

## How to repeat

```bash
pwsh scripts/test.ps1 -Suite legal      # starts the test-only stack with accounts on, seeds synthetic accounts, runs the legal specs
```
