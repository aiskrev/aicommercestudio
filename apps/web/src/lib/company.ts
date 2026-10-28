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
