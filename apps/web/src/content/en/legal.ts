import type { LegalDocument } from "@/content/types";
import { company } from "@/lib/company";
import { legalVersion } from "@/lib/legal-versions";

/**
 * Legal texts (English). The Bulgarian version prevails. The review status is the same as in the Bulgarian
 * file: the amendments of version 2026-11-10 are NOT reviewed by a lawyer yet (lib/legal-versions.json).
 */
export { COOKIE_POLICY_IS_DRAFT, LEGAL_TEXTS_ARE_DRAFTS } from "@/content/bg/legal";

export const legalDraftNotice =
  "Draft: this text is a template. It must be completed with the company's details and reviewed by a lawyer before publication.";

export const privacyPolicy: LegalDocument = {
  title: "Privacy policy",
  metaDescription:
    "How A.I. Commerce Studio processes personal data from the contact forms, the AI advisor, customer accounts, payments and invoices: purposes, legal bases, retention, processors and your GDPR rights.",
  updated: legalVersion("privacy"),
  intro:
    "This policy describes how we process the personal data you provide through this website, in accordance with Regulation (EU) 2016/679 (GDPR) and Bulgarian law. Some features (customer accounts, paid plans, site statistics) are switched on only when they are ready; the text says which.",
  sections: [
    {
      heading: "1. Data controller",
      paragraphs: [
        `Controller: ${company.legalNameEn}, UIC ${company.uic}, registered office and address of management: ${company.registeredOfficeEn}.`,
        `Email for data protection questions: ${company.contactEmail}. The company has not appointed a data protection officer.`,
      ],
    },
    {
      heading: "2. Contact forms and quote requests",
      paragraphs: ["Through the contact and quote forms we collect only the data needed to respond to your inquiry:"],
      bullets: [
        "full name;",
        "company name;",
        "business email address;",
        "phone number (optional);",
        "the selected service and the project description;",
        "the website language in which you sent the inquiry;",
        "the date and time of the inquiry, the version of this policy you acknowledged and (only if you tick the box) your separate consent to news and offers with its version and time;",
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
      heading: "5. Customer accounts",
      paragraphs: [
        "This feature is switched on when the client area is released. Then we process:",
      ],
      bullets: [
        "email address and an optional display name, language and the date the account was created;",
        "the password — only as an irreversible hash; the password itself is not stored and cannot be read by us;",
        "email verification and one-time links for verification and password recovery (stored as hashes and valid for a limited time);",
        "the version of this policy you acknowledged at registration and the time you did so;",
        "your separate consent to news and offers (whether given, its version and time) and changes to it;",
        "sign-in sessions: a hash of the session identifier, a short description of the browser, a hash of the IP address, the time of creation and last use; limits on failed sign-in attempts and temporary lockout;",
        "technical records of the emails sent to you (recipient, type and delivery status) and a security log of actions on the account;",
        "the workspace data you enter yourself: projects and assessment versions, the selected plan and monthly usage.",
      ],
    },
    {
      heading: "6. Paid plans and payments",
      paragraphs: [
        "This feature is switched on when paid plans are released. Payment is made with Stripe; card details are entered directly there and never reach us. We keep:",
      ],
      bullets: [
        "the selected plan or service, billing interval, price and currency;",
        "identifiers of the customer, the subscription, the payment and the checkout session at Stripe;",
        "the subscription status, the end of the paid period and failed payments;",
        "refunds, disputed payments and their statuses;",
        "the terms accepted: which version of the Terms and Conditions and of the Subscription and Payment Terms you accepted, when, in which language and (for consumers only) the separate request for the service to start within the withdrawal period.",
      ],
    },
    {
      heading: "7. Invoices and accounting documents",
      paragraphs: [
        "An electronic accounting document is issued for each payment. For this we process: the name or company name for billing, address, country, billing email, company number (UIC) and VAT number (where applicable), and the history of invoices and credit notes. Documents contain their own copy of the buyer's details at the time of issue and do not change after issue.",
      ],
    },
    {
      heading: "8. Withdrawal and support requests",
      paragraphs: [
        "When you submit a request to withdraw from a contract or contact support in the client area, we process: a unique reference number, the contract or purchase it concerns, the text of your statement, the times of submission and handling, the type of customer (consumer or business), the status and outcome of the request (including any refund reference) and the confirmation sent to your email.",
      ],
    },
    {
      heading: "9. Site statistics",
      paragraphs: [
        "When statistics are switched on, we count visits anonymously and without cookies: we record the page visited, the language, the type of device, the site you came from and which links and buttons are clicked. We do not record an IP address, a browser or a visitor identifier, and we do not follow visits from one day to the next. Visitors who send Do Not Track or Global Privacy Control are not counted. The data is kept for up to 180 days.",
      ],
    },
    {
      heading: "10. Purposes and legal bases",
      paragraphs: [
        "Responding to your inquiry and preparing a quote — taking steps at your request prior to entering into a contract (Art. 6(1)(b) GDPR).",
        "Creating and maintaining a customer account, providing paid plans and accepting payments — performance of a contract (Art. 6(1)(b) GDPR).",
        "Issuing and keeping invoices and other accounting documents, handling withdrawal from a contract and refunds — compliance with a legal obligation (Art. 6(1)(c) GDPR) and, to the extent necessary for performing the contract, Art. 6(1)(b).",
        "Protecting the website and accounts from spam and abuse, sign-in limits, security logs and anonymous site statistics — legitimate interest (Art. 6(1)(f) GDPR).",
        "Sending information about services and useful materials — only on the basis of separate, explicit consent (Art. 6(1)(a) GDPR). Consent is not a condition for sending an inquiry, for registering or for paying, and can be withdrawn at any time.",
      ],
    },
    {
      heading: "11. Retention",
      paragraphs: [
        "Inquiry data is kept for up to 24 months after the last communication, unless a contractual relationship arises, in which case the periods under that contract and the law apply. After that, the data is deleted automatically.",
        "Customer account data is kept while the account exists; an account whose email has not been confirmed is deleted automatically after 30 days. You can ask for deletion at any time (section 15). Sign-in sessions last up to 12 hours and end after 120 minutes of inactivity; verification and password-recovery links are valid for 24 hours and 1 hour respectively; technical records of emails sent are kept for up to 30 days.",
        "Accounting documents and the payment data we need to meet legal obligations are kept for the period required by accounting and tax law. This period is subject to confirmation by an accountant and applies regardless of the deletion of the account. Withdrawal requests are kept for the period for protecting legal claims and for accounting purposes.",
        "The administrative action log does not contain the content of inquiries and is kept for up to 36 months for security purposes. Database backups are kept for up to 14 days and then overwritten.",
      ],
    },
    {
      heading: "12. Recipients, processors and transfers outside the EU",
      paragraphs: [
        "The data is accessible only to authorized staff of the controller. We use hosting and infrastructure providers as processors: Hetzner Online GmbH (hosting, Germany) and Cloudflare, Inc. (content delivery, protection and email forwarding, USA).",
        "Payments are processed by Stripe Payments Europe Ltd. (Ireland) and its affiliates; Stripe processes payment data under its own privacy policy. When the sign-up forms are protected with Cloudflare Turnstile, the data of the check is processed by Cloudflare.",
        "If we use an AI model provider or an email service, it is named in this list, processes data only on our instructions and under a data processing agreement. If data is transferred outside the European Economic Area, this happens only with appropriate safeguards under Chapter V GDPR, such as standard contractual clauses.",
      ],
    },
    {
      heading: "13. Customer data in AI Managed Services",
      paragraphs: [
        "Under an AI Managed Services contract we process data from your AI systems (for example logs, metrics and sample conversations) as a processor on your behalf, under a separate data processing agreement under Art. 28 GDPR. Scope, retention and security measures are set out in that agreement; we provide a template data processing schedule on request. The roles of the parties are determined by the actual arrangement, not automatically for every processing operation.",
        "We apply data minimization: we monitor technical metrics where that is sufficient, and use conversation content only where agreed, where necessary and with restricted access. Using our services does not by itself make your processing GDPR-compliant — responsibility for your own AI systems remains with you as the controller.",
      ],
    },
    {
      heading: "14. Your rights",
      paragraphs: ["You have the right to:"],
      bullets: [
        "access your personal data;",
        "rectify inaccurate data;",
        "erasure (the \"right to be forgotten\"), noting that some data — for example accounting documents — must be kept after an account is deleted;",
        "restriction of processing;",
        "data portability, where processing is based on consent or a contract and is carried out by automated means;",
        "object to processing based on legitimate interest;",
        "withdraw consent at any time, without affecting the lawfulness of processing before the withdrawal;",
        "lodge a complaint with the Bulgarian Commission for Personal Data Protection (www.cpdp.bg) or the supervisory authority in your country.",
      ],
    },
    {
      heading: "15. How to exercise your rights",
      paragraphs: [
        `Send a request to ${company.contactEmail} from the email address you used for the inquiry or for registering, or quote the inquiry's reference number. We may ask for additional information to confirm your identity.`,
        "In the client area (when it is switched on) you can download the data of your account yourself, correct your profile, withdraw consent to news, end your sessions and submit a request to delete the account.",
        "We respond within one month. On deletion, the inquiry, its notes and any attached AI assessment are removed; the action log keeps only a record that a deletion took place, without the personal data. When an account is deleted, sign-in data and the profile are removed or anonymized; accounting documents and payment data that the law requires us to keep remain for the legal period and are not used for any other purpose.",
      ],
    },
    {
      heading: "16. Security",
      paragraphs: [
        "We apply technical and organizational measures: encrypted connections, controlled access with individual accounts, passwords stored only as hashes, protection against forged requests, rate limits and temporary lockout after failed sign-in attempts, email confirmation, separation of data between workspaces, an action log, minimal data collection and automatic deletion when the retention period ends.",
      ],
    },
    {
      heading: "17. Changes to this policy",
      paragraphs: [
        "When the policy changes, we publish the current version on this page with a new date and version. The version you acknowledged when sending an inquiry or registering is stored with it. A change to this policy alone does not require new consent; changes to the terms of a contract (the Terms and Conditions, the Subscription and Payment Terms) are communicated and apply in the way set out in them.",
      ],
    },
  ],
};

export const cookiePolicy: LegalDocument = {
  title: "Cookie information",
  metaDescription:
    "Which cookies and browser data the A.I. Commerce Studio website uses. Public pages use no tracking or marketing cookies.",
  updated: legalVersion("cookies"),
  intro:
    "We respect your privacy. Public pages use no analytics, advertising or tracking cookies and load no third-party scripts (checked on 10 November 2026 on the application itself, without Cloudflare in front: opening the pages sets no cookies and loads no resources from other domains). The cookies below are set only on the action described or in the protected areas of the site.",
  sections: [
    {
      heading: "1. Website cookies (first-party)",
      paragraphs: ["Only the following cookies are used. All are first-party, have no advertising or tracking purpose and contain no personal data, except that a session identifier is tied to your sign-in:"],
      bullets: [
        "acs_locale — remembers the language (Bulgarian or English) you explicitly chose with the language switcher; set only when you choose; valid for up to 12 months. Purpose: remembers the language choice you made.",
        "acs_cookie_notice — remembers that you closed the cookie notice; set when you close it; valid for up to 12 months. Purpose: remembers your choice about the notice.",
        "acs_session and acs_csrf — a secure (HttpOnly) cookie for an administrator's session and a token against cross-site request forgery (CSRF); only in the administration area and only for signed-in staff; the session is valid for up to 8 hours or until logout and ends after 60 minutes of inactivity; set at sign-in. Purpose: the sign-in you requested.",
        "acs_account_session and acs_account_csrf — the same for customer accounts (the session is HttpOnly): set at sign-in to the client area when it is switched on; valid for up to 12 hours or until logout, and the session ends after 120 minutes of inactivity. Purpose: the sign-in you requested.",
        "acs_portal_session and acs_portal_csrf — the same for the portal for contracted clients; the feature is switched off and these cookies are not set until it is released; the session is valid for up to 8 hours.",
      ],
    },
    {
      heading: "2. Browser data (sessionStorage and localStorage)",
      paragraphs: [
        "If you hide the \"Request a quote\" bar on a mobile device, your browser remembers this until the session ends. The opportunity-finder and impact-calculator tools pass the process name you typed from one tool to the other until the session ends. This data is not sent to the server and disappears when you close the tab.",
        "Project configurator (when it is switched on): the answers you choose in the form — enumerated options such as the type of project and its features, with no name, e-mail address or other personal information — are kept in sessionStorage under a key that starts with \"acs.configurator.\" followed by the model version. They are kept only while you fill in the configurator, are deleted when the request is sent or the configuration is added to the basket, and disappear when you close the tab. They are not sent to the server until you add them to a request.",
        "Quote-request basket (when it is switched on): after you add the first item, your browser stores one key in localStorage — \"acs.quote-basket\" — holding a secret identifier of your draft and nothing else. The draft itself (the options you chose) is kept on our server without your name, e-mail address or telephone number, and only a hash of the identifier is stored there. Your contact details are sent only when you send the request. The key is needed so that we can find your draft the next time you open it; it is not used for tracking or advertising and is not shared with third parties. It is deleted when the request is sent, when you delete the basket, or when the draft expires (after 30 days by default). You can remove it at any time in your browser settings; you then lose access to that draft.",
      ],
    },
    {
      heading: "3. Third-party services",
      paragraphs: [
        "Public pages load no third-party resources. Fonts are served from our own server. The site is delivered and protected through the Cloudflare network. The application itself sets no cookies on the public pages; Cloudflare may set technical security cookies if its security assessment requires it. We will check this on the published site and update this policy if such cookies appear.",
        "When the sign-up forms are protected with Cloudflare Turnstile (a check against automated requests), the page will load a script from Cloudflare's domain on those forms only; the check is necessary for the security of the form.",
        "Payment for paid plans is made on a Stripe page (checkout.stripe.com) that is not part of our site. Stripe may set its own cookies on its domain under its own policy. We load no Stripe scripts in our pages.",
        "Anonymous site statistics, when switched on, use no cookies and write no data to your browser.",
      ],
    },
    {
      heading: "4. Cookie notice",
      paragraphs: [
        "On your first visit we show a short notice with a link to this page. The notice is informational and offers no choice about optional cookies, because none are used. The cookies above serve the sign-in you asked for or remember a choice you made. How they are classified under the consent rules is subject to legal review, and this policy will be updated if that is needed.",
      ],
    },
    {
      heading: "5. Future changes",
      paragraphs: [
        "If analytics, advertising or other optional cookies or technologies are added in the future, they will be activated only after your explicit consent, with the choices \"Accept\", \"Reject\" and \"Settings\" always reachable from the bottom of the page, and this page will be updated with a new version.",
      ],
    },
    {
      heading: "6. Managing cookies",
      paragraphs: [
        "You can delete or block cookies in your browser settings. Blocking the necessary cookies makes it impossible to sign in to the protected areas (the administration area and the client area), but does not affect the public pages.",
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: "Terms of use and legal information",
  metaDescription: "Terms of use for the A.I. Commerce Studio website and legal information about the service provider.",
  updated: legalVersion("terms"),
  intro:
    "These terms govern the use of the website. Terms for specific services are agreed separately in an individual quote and contract; paid plans in the client area are governed by the Subscription and Payment Terms.",
  sections: [
    {
      heading: "1. Provider information",
      paragraphs: [
        `${company.legalNameEn}, UIC ${company.uic}, registered office and address of management: ${company.registeredOfficeEn}, email: ${company.contactEmail}, phone: ${company.phoneDisplay}. "A.I. Commerce Studio" is a working trade name.`,
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
        "The prices published on the service pages, the workshop pages and the care-plan pages are indicative, in euro, and are not a binding offer. They are the same on the Bulgarian and the English versions of the site. The price, scope and timelines of each service are confirmed in a written quote once the needs are clear; the prices do not include hosting, third-party licences and the use of AI models unless stated otherwise.",
        "Paid plans in the client area (when released) are sold at the prices shown before the order, under the Subscription and Payment Terms.",
        "The descriptions of the proposed Essential Monitoring & Advisory, Managed AI Operations and Advanced AI Reliability & Optimization levels and of the care plans are illustrative. Response times, availability, support hours, included hours and other service levels are agreed only in a written individual contract; the website contains no guarantees about them. Where they are not agreed, the site shows \"Agreed in the individual contract\".",
      ],
    },
    {
      heading: "4. Maintenance and managed-service contracts",
      paragraphs: [
        "Care plans, cloud operations and AI Managed Services are not bought with an order on the site. They are governed by a separate written contract that sets the scope, the covered systems, the responsibilities of the parties, the service levels (including priorities, coverage hours, initial response targets and escalation), access to data, confidentiality, changes, recovery after incidents, third-party charges (for example cloud and AI providers) and the data processing schedule where applicable.",
        "These contracts are separate from the Subscription and Payment Terms, which apply only to paid plans in the client area. An individual quote is not a binding purchase until it is accepted in writing.",
      ],
    },
    {
      heading: "5. AI Automation Advisor",
      paragraphs: [
        "The AI advisor's results are indicative, generated automatically and do not constitute a quote, professional advice or a guarantee of results. In demonstration mode the result is assembled from templates and is not an analysis by an AI model.",
      ],
    },
    {
      heading: "6. Customer accounts",
      paragraphs: [
        "When the client area is switched on, registration requires an email address and a password and confirmation of the email. You are responsible for keeping your password confidential. The processing of personal data is described in the Privacy policy.",
      ],
    },
    {
      heading: "7. Intellectual property",
      paragraphs: [
        "The website's content — texts, graphics and code — is protected by copyright. Copying for commercial purposes without written permission is not allowed.",
      ],
    },
    {
      heading: "8. Liability",
      paragraphs: [
        "The information on the website is general in nature and is not professional advice for a specific case. We make every effort to keep it accurate and current, but are not liable for decisions based solely on it.",
      ],
    },
    {
      heading: "9. Governing law",
      paragraphs: [
        "Matters not covered here are governed by Bulgarian law. Consumers keep the rights they have under the mandatory provisions of the law of the country where they live and may bring proceedings before the competent court under the applicable European Union rules. Disputes are resolved by agreement or, failing that, by the competent court.",
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
    "Terms for A.I. Commerce Studio paid plans: ordering, prices, payment, renewal, cancellation, withdrawal from the contract, refunds and invoices.",
  updated: legalVersion("subscription_terms"),
  intro:
    "These terms govern paid plans and online payments in the A.I. Commerce Studio client area. They supplement the Terms of use and the Privacy policy. Services under an individual quote and contract (including maintenance and AI Managed Services) are governed by that quote and contract.",
  sections: [
    {
      heading: "1. Provider",
      paragraphs: [
        `${company.legalNameEn}, UIC ${company.uic}, registered office and address of management: ${company.registeredOfficeEn}, email: ${company.contactEmail}, phone: ${company.phoneDisplay}.`,
        "The company is not registered for VAT and does not charge VAT on its prices.",
      ],
    },
    {
      heading: "2. Subject and customers",
      paragraphs: [
        "Paid plans give access to additional features and higher limits in the client area workspace. The contents and limits of each plan are shown before ordering.",
        "A customer may be a natural person (consumer) or a legal entity or sole trader (business customer). When ordering, the customer states whether they buy as a consumer or as a business customer. These terms do not limit consumers' rights under the Bulgarian Consumer Protection Act.",
      ],
    },
    {
      heading: "3. Ordering, accepting the terms and concluding the contract",
      paragraphs: [
        "Orders are placed from a registered account with a confirmed email address. Before paying, the customer sees on one order-review page: the plan, the final price in euro, the billing period, that the subscription renews automatically, the renewal and cancellation conditions, the applicable terms and the Privacy policy.",
        "The customer must tick \"I have read and accept the Terms and Conditions and the Subscription and Payment Terms\". Without it, the order cannot be confirmed. The acceptance is recorded together with the version of the terms, the time and the order. The button that confirms the order is \"Order with payment obligation\".",
        "The contract is concluded when the payment provider confirms the payment. A confirmation is sent to the account's email address and is available in the client area.",
        "Some services require the scope to be agreed first. They can be paid only after the scope has been agreed in writing.",
      ],
    },
    {
      heading: "4. Prices",
      paragraphs: [
        "Prices are shown in euro (EUR) before ordering and are final for the chosen period. The company is not registered for VAT and no VAT is charged. The price of the same plan for the same period is the same on all language versions of the site and does not depend on language, country or address.",
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
      heading: "6. Renewal, failed payments and cancelling the subscription",
      paragraphs: [
        "A subscription renews automatically for the same period (month or year) until it is cancelled. The amount for the new period is charged to the same payment method.",
        "If a payment fails, the customer is notified and has 7 days to update the payment method. After that, paid features are suspended until a payment succeeds.",
        "A subscription can be cancelled at any time in the client area with the button \"Cancel subscription\". Cancellation stops further renewals and takes effect at the end of the period already paid; paid features remain available until then. Cancelling a subscription is not withdrawal from the contract under section 7. An unused part of a period is not refunded unless the law requires it.",
        "When a plan ends, no data is deleted: the workspace moves to the free plan, projects are kept, and results that need a paid plan are locked until it is renewed. Deleting an account and its data is covered by the Privacy policy.",
      ],
    },
    {
      heading: "7. Withdrawal from the contract (consumers' right)",
      paragraphs: [
        "A consumer may withdraw from the contract without giving a reason within 14 days of its conclusion. For this the consumer can use the function \"Withdraw from contract here\" in the client area or send an unequivocal statement to the email address in section 1. Withdrawal is not subject to our approval. The request receives a unique reference number and a confirmation to the account's email address; a staff member handles it, checking the type of customer and the period.",
        "If the consumer expressly asked for the service to start before the 14 days end (a separate tick box when ordering) and then withdraws, the consumer owes an amount proportionate to the use up to the withdrawal. This tick box does not remove the right of withdrawal. Refunds are made to the same payment method no later than 14 days after receiving the withdrawal, once the period and the proportionate part have been checked.",
        "The law provides exceptions to the right of withdrawal for some contracts, for example a fully performed service after the consumer's express consent and acknowledgement, or digital content. They apply only when all the statutory conditions are met and the consumer was informed of them before paying.",
        "Business customers have no right of withdrawal under this section.",
      ],
    },
    {
      heading: "8. Refunds and disputed payments",
      paragraphs: [
        "Outside section 7, amounts paid are not refunded, except for incorrect charges or when the service was not provided through our fault. Such refunds are made to the same payment method and a credit note is issued. Consumers' rights where a digital service is not supplied or does not conform, including a price reduction or termination of the contract, are not limited.",
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
        "Matters not covered here are governed by Bulgarian law. Consumers keep the rights they have under the mandatory provisions of the law of the country where they live and may bring proceedings before the competent court under the applicable European Union rules. Disputes not settled by agreement are resolved by the competent court.",
      ],
    },
    {
      heading: "13. Changes to these terms",
      paragraphs: [
        "Subscribers are told about changes to these terms by email at least 30 days before they take effect, and they apply from the next payment period. A change is not treated as accepted automatically: for a material change, the customer accepts the new version expressly before the next order. A subscriber who does not agree may cancel before that date.",
      ],
    },
  ],
};

export const withdrawalInfo: LegalDocument = {
  title: "Withdrawal from the contract and refunds",
  metaDescription:
    "How consumers can withdraw from a paid-plan contract with A.I. Commerce Studio, how to cancel a subscription and how refunds work.",
  updated: legalVersion("withdrawal_info"),
  intro:
    "This page sums up what applies when you want to withdraw from a paid plan, cancel a subscription or get a refund. The full terms are in the Subscription and Payment Terms.",
  sections: [
    {
      heading: "1. Withdrawal from the contract — consumers only",
      paragraphs: [
        "If you are a natural person buying as a consumer, you may withdraw from the contract without giving a reason within 14 days of its conclusion.",
        "Use \"Withdraw from contract here\" in the client area (the plan and payments section). You choose the purchase, write your statement and confirm it in a second step. You receive a reference number and a confirmation at your account's email address. You can also send a statement to the company's email address.",
        "If you asked for the service to start within the withdrawal period, you owe an amount proportionate to the use up to the withdrawal. Refunds go to the same payment method within 14 days of receiving the withdrawal, after the period and the proportionate part have been checked. Business customers have no right of withdrawal.",
      ],
    },
    {
      heading: "2. Cancelling a subscription — a different thing",
      paragraphs: [
        "\"Cancel subscription\" stops further renewals. The period already paid stays available until it ends and no amount is refunded unless the law requires it. Cancelling is not withdrawal from the contract.",
      ],
    },
    {
      heading: "3. Other refunds",
      paragraphs: [
        "We refund amounts for incorrect charges or when the service was not provided through our fault, to the same payment method, with a credit note. Consumers keep their statutory rights where a digital service is not supplied or does not conform.",
      ],
    },
    {
      heading: "4. Contact and complaints",
      paragraphs: [
        `Email: ${company.contactEmail}. Consumers may also turn to the Bulgarian Commission for Consumer Protection (www.kzp.bg).`,
      ],
    },
  ],
};
