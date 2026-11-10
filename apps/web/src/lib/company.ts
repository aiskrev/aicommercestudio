/**
 * Approved company identity and public contact details (2026-10-28) — the single authoritative
 * source for every public contact surface: the contact page, the footer, the founder profile and
 * structured data. PROTECTED: change these values only on the owner's explicit request
 * (see CLAUDE.md → "Protected content").
 *
 * - The mailbox lives on the planned domain. The e-mail is derived from the domain
 *   (`contact@<domain>`), so changing the domain — here or with PUBLIC_CONTACT_DOMAIN — moves the
 *   e-mail with it on every surface. Neither the domain nor the mailbox is active yet and e-mail
 *   delivery has not been verified; the flags below record that. Nothing here sends e-mail.
 * - A deployment may override the values with PUBLIC_CONTACT_PHONE / PUBLIC_CONTACT_DOMAIN /
 *   PUBLIC_CONTACT_EMAIL (baked into the web build; an explicit e-mail wins over the derived one).
 *   No component holds its own copy (enforced by lib/company.test.ts).
 * - Production builds set PUBLIC_CONTACT_DOMAIN and PUBLIC_CONTACT_EMAIL from repository variables (the Release
 *   workflow refuses to build without them): on 2026-11-10 the live site shows contact@ai-commercestudio.com, whose
 *   domain has Cloudflare Email Routing records (inbound). The fallback below is only for builds without them.
 *   `emailDeliveryVerified` stays false until the owner confirms a real message was received.
 * - This is not the production site URL: SITE_URL, canonical URLs, CORS and authentication origins
 *   are configured separately (lib/site.ts, API settings).
 */

const APPROVED = {
  phone: "+359 882 377 753",
  domain: "ai-ecomstudio.site",
  mailbox: "contact",
} as const;

const plannedDomain = process.env.PUBLIC_CONTACT_DOMAIN || APPROVED.domain;
const phoneDisplay = process.env.PUBLIC_CONTACT_PHONE || APPROVED.phone;
const contactEmail = process.env.PUBLIC_CONTACT_EMAIL || `${APPROVED.mailbox}@${plannedDomain}`;
const phoneE164 = phoneDisplay.replace(/[^\d+]/g, "");

export const company = {
  /** The legal entity behind the A.I. Commerce Studio platform. */
  legalName: "Iskrev Consulting Ltd",
  /** Registered legal entity (Commercial Register data recorded in the project documentation; verify against the Register before changing). */
  legalNameBg: "„ИСКРЕВ КОНСУЛТИНГ“ ЕООД",
  legalNameEn: "“ISKREV CONSULTING” Ltd.",
  /** UIC / ЕИК. */
  uic: "207509557",
  registeredOfficeBg: "България, гр. София 1715, р-н Младост, жк Младост 4, бл. 457, вх. 1, ет. 13, ап. 75",
  registeredOfficeEn: "bl. 457, entr. 1, fl. 13, apt. 75, Mladost 4 housing estate, Mladost district, 1715 Sofia, Bulgaria",
  phoneDisplay,
  /** E.164 form, used in `tel:` links and structured data. */
  phoneE164,
  phoneUri: `tel:${phoneE164}`,
  contactEmail,
  contactEmailUri: `mailto:${contactEmail}`,
  /** Planned public domain; not live, not the canonical origin. */
  plannedDomain,
  emailDeliveryVerified: false,
  publicWebsiteLaunched: false,
} as const;
