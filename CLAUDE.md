# A.I. Commerce Studio — instructions for AI coding agents

## Protected content — do not remove, replace or rewrite without the owner's explicit request

The owner has approved the items below. A task about something else (a redesign, a new page, a
navigation or homepage change, a refactor, a content rewrite) must keep them exactly as they are,
on every surface where they appear. If a change seems to require touching them, stop and ask.

1. **Founder portrait** — `apps/web/src/assets/founder/aleksandar-iskrev.webp` (the approved photo;
   its SHA-256 is pinned in `apps/web/src/lib/protected-content.test.ts`). It is rendered only through
   `FounderPortrait` (`components/sections/Founder.tsx`) on the homepage, the About page and the
   founder profile (`/bg/za-nas/osnovatel` ↔ `/en/about/founder`). Never delete, recompress, crop,
   swap or replace it with a placeholder or an AI-generated image.
2. **Public contact details** — phone `+359 882 377 753`, e-mail `contact@ai-ecomstudio.site`,
   planned domain `ai-ecomstudio.site`, legal entity Iskrev Consulting Ltd. The single authoritative
   source is `apps/web/src/lib/company.ts` (overridable per build with `PUBLIC_CONTACT_PHONE`,
   `PUBLIC_CONTACT_DOMAIN`, `PUBLIC_CONTACT_EMAIL`; the e-mail follows the domain). Every surface —
   the contact page, the footer, the founder profile and structured data — reads it through
   `ContactDetails` or `company`. Never hard-code these values anywhere else, and never remove
   `ContactDetails` from the contact page, the footer or the founder profile.
3. **Founder profile content** — `content/{bg,en}/founder.ts` and the founder page.
4. **The logo** — do not change it.

`lib/protected-content.test.ts` and `lib/company.test.ts` fail if any of this disappears or is
duplicated. Do not weaken or delete those tests to make another change pass.

## Working rules

* Do not deploy, push to production or apply production migrations without explicit approval.
* Never read or print credentials from `.env`.
* Commit and push only when asked; no force-push without explicit approval.
* No invented metrics, client results or claims.
