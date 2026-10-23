import type { LegalDocument } from "@/content/types";

/**
 * DRAFT legal texts (English). Placeholders in [square brackets] must be completed and the texts
 * reviewed by a qualified lawyer before the site is published. The Bulgarian version prevails
 * unless the reviewed texts state otherwise.
 */
export { LEGAL_TEXTS_ARE_DRAFTS } from "@/content/bg/legal";

export const legalDraftNotice =
  "Draft: this text is a template. It must be completed with the company's details and reviewed by a lawyer before publication.";

export const privacyPolicy: LegalDocument = {
  title: "Privacy policy",
  metaDescription:
    "How A.I. Commerce Studio processes personal data from the contact forms and the AI advisor: purposes, legal bases, retention, processors and your GDPR rights.",
  updated: "2026-10-25",
  intro:
    "This policy describes how we process the personal data you provide through this website, in accordance with Regulation (EU) 2016/679 (GDPR) and Bulgarian law.",
  sections: [
    {
      heading: "1. Data controller",
      paragraphs: [
        "Controller: [Company name], UIC [company ID], registered office and address of management: [Address].",
        "Email for data protection questions: [contact email]. Data protection officer: [if applicable].",
      ],
    },
    {
      heading: "2. What data we collect",
      paragraphs: ["Through the contact and quote forms we collect only the data needed to respond to your inquiry:"],
      bullets: [
        "full name;",
        "company name;",
        "business email address;",
        "phone number (optional);",
        "the selected service and the project description;",
        "the website language in which you sent the inquiry;",
        "the date and time of the inquiry and the version of this policy you acknowledged;",
        "a cryptographic hash of your IP address — used only to protect against abuse; the IP address itself is not stored.",
      ],
    },
    {
      heading: "3. AI Managed Services inquiries",
      paragraphs: [
        "For an inquiry about operating an AI system we also collect: industry, type of AI solution, approximate number of agents or workflows, the name of the AI model provider and the hosting type (if you provide them), a description of the operational problems, the support you are looking for and your preferred communication language.",
        "We explicitly ask you not to send passwords, API keys, access tokens, customer records or confidential documents. The form rejects text that looks like such data. Access to your systems is agreed separately, after an assessment and under a signed contract.",
      ],
    },
    {
      heading: "4. AI Automation Advisor",
      paragraphs: [
        "The AI advisor does not require personal data. Email addresses, phone numbers and links are removed from the description before it is processed. Unless you untick the save option, the assessment is kept for [30 days] and then deleted automatically; if you request a consultation, it is attached to your inquiry and follows that inquiry's retention period.",
        "When an AI model is enabled, the description (without the removed data) is sent to the model provider solely to generate the assessment. Without a configured provider the advisor runs in demonstration mode and sends no data outside our infrastructure.",
      ],
    },
    {
      heading: "5. Purposes and legal bases",
      paragraphs: [
        "Responding to your inquiry and preparing a quote — taking steps at your request prior to entering into a contract (Art. 6(1)(b) GDPR).",
        "Protecting the website from spam and abuse — legitimate interest (Art. 6(1)(f) GDPR).",
        "Sending information about services and useful materials — only on the basis of separate, explicit consent (Art. 6(1)(a) GDPR). Consent is not a condition for sending an inquiry and can be withdrawn at any time.",
      ],
    },
    {
      heading: "6. Retention",
      paragraphs: [
        "Inquiry data is kept for up to [24 months] after the last communication, unless a contractual relationship arises, in which case the periods under that contract and the law apply. After that, the data is deleted automatically.",
        "The administrative action log does not contain the content of inquiries and is kept for up to [36 months] for security purposes. Database backups are kept for up to [14 days] and then overwritten.",
      ],
    },
    {
      heading: "7. Recipients, processors and transfers outside the EU",
      paragraphs: [
        "The data is accessible only to authorized staff of the controller. We use hosting and infrastructure providers as processors: [list of processors and the countries where they are located].",
        "If we use an AI model provider or an email service, it is named in this list, processes data only on our instructions and under a data processing agreement. If data is transferred outside the European Economic Area, this happens only with appropriate safeguards under Chapter V GDPR, such as standard contractual clauses. [To be completed once providers are selected.]",
      ],
    },
    {
      heading: "8. Customer data in AI Managed Services",
      paragraphs: [
        "Under an AI Managed Services contract we process data from your AI systems (for example logs, metrics and sample conversations) as a processor on your behalf, under a separate data processing agreement. Scope, retention and security measures are set out in that agreement.",
        "We apply data minimization: we monitor technical metrics where that is sufficient, and use conversation content only where agreed, where necessary and with restricted access. Using our services does not by itself make your processing GDPR-compliant — responsibility for your own AI systems remains with you as the controller.",
      ],
    },
    {
      heading: "9. Your rights",
      paragraphs: ["You have the right to:"],
      bullets: [
        "access your personal data;",
        "rectify inaccurate data;",
        "erasure (the \"right to be forgotten\");",
        "restriction of processing;",
        "data portability;",
        "object to processing based on legitimate interest;",
        "withdraw consent at any time, without affecting the lawfulness of processing before the withdrawal;",
        "lodge a complaint with the Bulgarian Commission for Personal Data Protection (www.cpdp.bg) or the supervisory authority in your country.",
      ],
    },
    {
      heading: "10. How to request access or deletion",
      paragraphs: [
        "Send a request to [contact email] from the email address you used for the inquiry, or quote the inquiry's reference number. We may ask for additional information to confirm your identity.",
        "We respond within one month. On deletion, the inquiry, its notes and any attached AI assessment are removed; the action log keeps only a record that a deletion took place, without the personal data.",
      ],
    },
    {
      heading: "11. Security",
      paragraphs: [
        "We apply technical and organizational measures: encrypted connections, controlled access with individual accounts, an action log, minimal data collection and automatic deletion when the retention period ends.",
      ],
    },
    {
      heading: "12. Changes to this policy",
      paragraphs: [
        "When the policy changes, we publish the current version on this page with a new date. The version you acknowledged when sending an inquiry is stored with it.",
      ],
    },
  ],
};

export const cookiePolicy: LegalDocument = {
  title: "Cookie information",
  metaDescription:
    "Which cookies the A.I. Commerce Studio website uses. Public pages use no tracking or marketing cookies.",
  updated: "2026-10-25",
  intro:
    "We respect your privacy. The website uses no analytics, advertising or tracking cookies and loads no third-party scripts.",
  sections: [
    {
      heading: "1. Cookies we use",
      paragraphs: ["Only the following cookies are used:"],
      bullets: [
        "acs_locale — remembers the language (Bulgarian or English) you explicitly chose with the language switcher; set only when you choose and valid for up to [12 months]. It contains no personal data.",
        "acs_session — a secure (HttpOnly) cookie for an administrator's session, only in the administration area; valid for up to [8 hours] or until logout.",
        "acs_csrf — a security token against cross-site request forgery (CSRF) in the administration area; valid for the same period.",
      ],
    },
    {
      heading: "2. Why there is no consent banner",
      paragraphs: [
        "Strictly necessary cookies and the cookie for a language you chose do not require consent. Because the website uses no other cookies, we do not show a consent banner.",
        "If you hide the \"Request a quote\" bar on a mobile device, your browser remembers this for the current session only (sessionStorage); the information is not sent to the server.",
      ],
    },
    {
      heading: "3. Future changes",
      paragraphs: [
        "If analytics or other optional cookies are added in the future, they will be activated only after your explicit consent, and this page will be updated.",
      ],
    },
    {
      heading: "4. Managing cookies",
      paragraphs: [
        "You can delete or block cookies in your browser settings. Blocking the necessary cookies makes it impossible to log in to the administration area, but does not affect the public pages.",
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: "Terms of use and legal information",
  metaDescription: "Terms of use for the A.I. Commerce Studio website and legal information about the service provider.",
  updated: "2026-10-25",
  intro:
    "These terms govern the use of the website. Terms for specific services are agreed separately in an individual quote and contract.",
  sections: [
    {
      heading: "1. Provider information",
      paragraphs: [
        "[Company name], UIC [company ID], registered office and address of management: [Address], email: [email], phone: [phone]. \"A.I. Commerce Studio\" is a working trade name.",
        "[VAT registration details, if applicable.]",
      ],
    },
    {
      heading: "2. Subject",
      paragraphs: [
        "The website provides information about our services and the option to send an inquiry. Sending an inquiry creates no contractual obligation for either party.",
      ],
    },
    {
      heading: "3. Prices, plans and service levels",
      paragraphs: [
        "No binding prices are published on the website. The price, scope and timelines of each service are set in a written quote once the needs are clear.",
        "The descriptions of the AI Monitor, AI Care and AI Optimize plans are illustrative. Response times, availability, support hours and other service levels are agreed only in a written contract; the website contains no guarantees about them.",
      ],
    },
    {
      heading: "4. AI Automation Advisor",
      paragraphs: [
        "The AI advisor's results are indicative, generated automatically and do not constitute a quote, professional advice or a guarantee of results. In demonstration mode the result is assembled from templates and is not an analysis by an AI model.",
      ],
    },
    {
      heading: "5. Intellectual property",
      paragraphs: [
        "The website's content — texts, graphics and code — is protected by copyright. Copying for commercial purposes without written permission is not allowed.",
      ],
    },
    {
      heading: "6. Liability",
      paragraphs: [
        "The information on the website is general in nature and is not professional advice for a specific case. We make every effort to keep it accurate and current, but are not liable for decisions based solely on it.",
      ],
    },
    {
      heading: "7. Governing law",
      paragraphs: [
        "Matters not covered here are governed by Bulgarian law. Disputes are resolved by agreement or, failing that, by the competent Bulgarian court.",
      ],
    },
  ],
};
