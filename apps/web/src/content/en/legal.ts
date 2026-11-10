import type { LegalDocument } from "@/content/types";
import { company } from "@/lib/company";

/** Legal texts (English). The Bulgarian version prevails. */
export { COOKIE_POLICY_IS_DRAFT, LEGAL_TEXTS_ARE_DRAFTS } from "@/content/bg/legal";

export const legalDraftNotice =
  "Draft: this text is a template. It must be completed with the company's details and reviewed by a lawyer before publication.";

export const privacyPolicy: LegalDocument = {
  title: "Privacy policy",
  metaDescription:
    "How A.I. Commerce Studio processes personal data from the contact forms and the AI advisor: purposes, legal bases, retention, processors and your GDPR rights.",
  updated: "2026-11-04",
  intro:
    "This policy describes how we process the personal data you provide through this website, in accordance with Regulation (EU) 2016/679 (GDPR) and Bulgarian law.",
  sections: [
    {
      heading: "1. Data controller",
      paragraphs: [
        "Controller: “ISKREV CONSULTING” Ltd., UIC 207509557, registered office and address of management: bl. 457, entr. 1, fl. 13, apt. 75, Mladost 4 housing estate, Mladost district, 1715 Sofia, Bulgaria.",
        `Email for data protection questions: ${company.contactEmail}. The company has not appointed a data protection officer.`,
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
        "The AI advisor does not require personal data. Email addresses, phone numbers and links are removed from the description before it is processed. Unless you untick the save option, the assessment is kept for 30 days and then deleted automatically; if you request a consultation, it is attached to your inquiry and follows that inquiry's retention period.",
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
        "Inquiry data is kept for up to 24 months after the last communication, unless a contractual relationship arises, in which case the periods under that contract and the law apply. After that, the data is deleted automatically.",
        "The administrative action log does not contain the content of inquiries and is kept for up to 36 months for security purposes. Database backups are kept for up to 14 days and then overwritten.",
      ],
    },
    {
      heading: "7. Recipients, processors and transfers outside the EU",
      paragraphs: [
        "The data is accessible only to authorized staff of the controller. We use hosting and infrastructure providers as processors: Hetzner Online GmbH (hosting, Germany) and Cloudflare, Inc. (content delivery, protection and email forwarding, USA).",
        "If we use an AI model provider or an email service, it is named in this list, processes data only on our instructions and under a data processing agreement. If data is transferred outside the European Economic Area, this happens only with appropriate safeguards under Chapter V GDPR, such as standard contractual clauses.",
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
        `Send a request to ${company.contactEmail} from the email address you used for the inquiry, or quote the inquiry's reference number. We may ask for additional information to confirm your identity.`,
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
  updated: "2026-11-03",
  intro:
    "We respect your privacy. The website uses no analytics, advertising or tracking cookies and loads no third-party scripts.",
  sections: [
    {
      heading: "1. Cookies we use",
      paragraphs: ["Only the following cookies are used:"],
      bullets: [
        "acs_locale — remembers the language (Bulgarian or English) you explicitly chose with the language switcher; set only when you choose and valid for up to 12 months. It contains no personal data.",
        "acs_cookie_notice — remembers that you closed the cookie notice so that it is not shown again; valid for up to 12 months. It contains no personal data.",
        "acs_session — a secure (HttpOnly) cookie for an administrator's session, only in the administration area; valid for up to 8 hours or until logout, and the session ends after 60 minutes of inactivity.",
        "acs_csrf — a security token against cross-site request forgery (CSRF) in the administration area; valid for the same period.",
      ],
    },
    {
      heading: "2. Cookie notice",
      paragraphs: [
        "On your first visit we show a short notice that explains which cookies we use, with a link to this page. Strictly necessary cookies and the cookie for a language you chose do not require consent, so the notice is informational and offers no choice about optional cookies.",
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
  updated: "2026-11-04",
  intro:
    "These terms govern the use of the website. Terms for specific services are agreed separately in an individual quote and contract.",
  sections: [
    {
      heading: "1. Provider information",
      paragraphs: [
        `“ISKREV CONSULTING” Ltd., UIC 207509557, registered office and address of management: bl. 457, entr. 1, fl. 13, apt. 75, Mladost 4 housing estate, Mladost district, 1715 Sofia, Bulgaria, email: ${company.contactEmail}, phone: ${company.phoneDisplay}. "A.I. Commerce Studio" is a working trade name.`,
        "The company is not registered for VAT.",
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
        "The descriptions of the proposed Essential Monitoring & Advisory, Managed AI Operations and Advanced AI Reliability & Optimization levels are illustrative. Response times, availability, support hours and other service levels are agreed only in a written contract; the website contains no guarantees about them.",
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

export { SUBSCRIPTION_TERMS_ARE_DRAFT } from "@/content/bg/legal";

export const subscriptionTermsDraftNotice =
  "Draft: these terms have not yet been reviewed by a lawyer and do not apply until paid plans are released.";

export const subscriptionTerms: LegalDocument = {
  title: "Subscription and payment terms",
  metaDescription:
    "Terms for A.I. Commerce Studio paid plans: ordering, prices, payment, renewal, cancellation, withdrawal, refunds and invoices.",
  updated: "2026-11-10",
  intro:
    "These terms govern paid plans and online payments in the A.I. Commerce Studio client area. They supplement the Terms of use and the Privacy policy. Services under an individual quote and contract are governed by that quote and contract.",
  sections: [
    {
      heading: "1. Provider",
      paragraphs: [
        `“ISKREV CONSULTING” Ltd., UIC 207509557, registered office and address of management: bl. 457, entr. 1, fl. 13, apt. 75, Mladost 4 housing estate, Mladost district, 1715 Sofia, Bulgaria, email: ${company.contactEmail}, phone: ${company.phoneDisplay}.`,
        "The company is not registered for VAT and does not charge VAT on its prices.",
      ],
    },
    {
      heading: "2. Subject and customers",
      paragraphs: [
        "Paid plans give access to additional features and higher limits in the client area workspace. The contents and limits of each plan are shown before ordering.",
        "A customer may be a natural person (consumer) or a legal entity or sole trader (business customer). These terms do not limit consumers' rights under the Bulgarian Consumer Protection Act.",
      ],
    },
    {
      heading: "3. Ordering and conclusion of the contract",
      paragraphs: [
        "Orders are placed from a registered account with a confirmed email address. Before paying, the customer sees the plan, the price, the billing period and these terms, and accepts them expressly.",
        "The contract is concluded when the payment provider confirms the payment. A confirmation is sent to the account's email address and is available in the client area.",
        "Some services require the scope to be agreed first. They can be paid only after the scope has been agreed in writing.",
      ],
    },
    {
      heading: "4. Prices",
      paragraphs: [
        "Prices are shown in euro (EUR) before ordering and are final for the chosen period. The company is not registered for VAT and no VAT is charged.",
        "Plan prices may change. A change does not affect a period already paid. Subscribers are told by email at least 30 days before a new price applies to their next period and may cancel before it does.",
      ],
    },
    {
      heading: "5. Payment",
      paragraphs: [
        "Payments are processed by Stripe Payments Europe Ltd. Card details are entered directly with Stripe and never reach us. The available methods (for example card, Apple Pay, Google Pay) depend on the device and browser and are shown at checkout.",
        "Subscriptions are paid in advance at the start of each period.",
      ],
    },
    {
      heading: "6. Renewal, failed payments and cancellation",
      paragraphs: [
        "A subscription renews automatically for the same period (month or year) until it is cancelled. The amount for the new period is charged to the same payment method.",
        "If a payment fails, the customer is notified and has 7 days to update the payment method. After that, paid features are suspended until a payment succeeds.",
        "A subscription can be cancelled at any time in the client area. Cancellation takes effect at the end of the period already paid, and paid features remain available until then. An unused part of a period is not refunded unless the law requires it (section 7).",
        "When a plan ends, no data is deleted: the workspace moves to the free plan, projects are kept, and results that need a paid plan are locked until it is renewed. Deleting an account and its data is covered by the Privacy policy.",
      ],
    },
    {
      heading: "7. Consumers' right of withdrawal",
      paragraphs: [
        "A consumer may withdraw from the contract without giving a reason within 14 days of its conclusion by sending a statement to the email address in section 1 or from the client area.",
        "If the consumer expressly asked for the service to start before the 14 days end, a consumer who withdraws owes an amount proportionate to the use up to the withdrawal. Refunds are made to the same payment method within 14 days of receiving the withdrawal.",
        "Business customers have no right of withdrawal under this section.",
      ],
    },
    {
      heading: "8. Refunds and disputed payments",
      paragraphs: [
        "Outside section 7, amounts paid are not refunded, except for incorrect charges or when the service was not provided through our fault. Such refunds are made to the same payment method and a credit note is issued.",
        "Before disputing a payment with their bank, customers can contact us by email so that we can resolve the matter quickly.",
      ],
    },
    {
      heading: "9. Invoices",
      paragraphs: [
        "An electronic accounting document is issued for each payment, based on the billing details the customer enters in the client area. Documents are available there to the workspace owner and to users with the billing role.",
        "The customer is responsible for the accuracy of the billing details. A change applies only to documents issued after it.",
      ],
    },
    {
      heading: "10. Use and limits",
      paragraphs: [
        "Each plan has monthly limits, shown in the client area. When a limit is reached, the feature stops until the next calendar month begins or until the customer moves to a higher plan.",
        "Results generated with artificial intelligence are indicative and are not professional advice or a guarantee of any outcome.",
        "We may suspend access in case of abuse, attempts to circumvent the limits or a breach of the system's security, telling the customer the reason.",
      ],
    },
    {
      heading: "11. Liability",
      paragraphs: [
        "Towards business customers, our liability for damage related to a paid plan is limited to the amount paid for the plan in the previous 12 months, except in cases of intent or gross negligence. Towards consumers, statutory liability applies.",
      ],
    },
    {
      heading: "12. Complaints and disputes",
      paragraphs: [
        "Complaints are sent to the email address in section 1. We reply within 14 days.",
        "Consumers may also turn to the Bulgarian Commission for Consumer Protection (www.kzp.bg) and its conciliation committees for out-of-court dispute resolution.",
        "Matters not covered here are governed by Bulgarian law. Disputes not settled by agreement are resolved by the competent Bulgarian court.",
      ],
    },
    {
      heading: "13. Changes to these terms",
      paragraphs: [
        "Subscribers are told about changes to these terms by email at least 30 days before they take effect. A subscriber who does not agree may cancel before that date.",
      ],
    },
  ],
};
