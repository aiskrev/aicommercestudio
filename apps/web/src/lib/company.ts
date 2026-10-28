/**
 * Approved company identity and public contact details (2026-10-28) — the single source for every
 * public contact surface: the contact page, the footer, the founder profile and structured data.
 *
 * - The mailbox lives on the planned domain `ai-ecomstudio.site`. Neither the domain nor the
 *   mailbox is active yet and e-mail delivery has not been verified; the flags below record that.
 *   Nothing here sends e-mail.
 * - A deployment may override the visible phone and e-mail with PUBLIC_CONTACT_PHONE /
 *   PUBLIC_CONTACT_EMAIL (baked into the web build). Changing the e-mail here or there updates every
 *   contact surface; no component holds its own copy.
 * - This is not the production site URL: SITE_URL, canonical URLs, CORS and authentication origins
 *   are configured separately (lib/site.ts, API settings).
 */

const phoneDisplay = process.env.PUBLIC_CONTACT_PHONE || "+359 882 377 753";
const contactEmail = process.env.PUBLIC_CONTACT_EMAIL || "contact@ai-ecomstudio.site";
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
  plannedDomain: "ai-ecomstudio.site",
  emailDeliveryVerified: false,
  publicWebsiteLaunched: false,
} as const;
