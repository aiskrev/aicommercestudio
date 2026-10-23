import type { Article } from "@/content/types";

/**
 * Editorial articles, October 2026 (English). Practical technical guidance only: no client results,
 * rankings, traffic figures or prices are claimed. Illustrative calculations are labelled as such.
 * Inline links use canonical route paths with English slugs.
 */
export const newArticles: Article[] = [
  {
    key: "tehnicheski-problemi-pri-online-magazinite",
    slug: "common-technical-problems-in-online-stores",
    title: "The most common technical problems in online stores — and how to catch them early",
    metaTitle: "The most common technical problems in online stores",
    description:
      "Eight technical problems that quietly cost online stores orders — from updates and slow categories to broken integrations and backups — and how to check for them.",
    type: "checklist",
    category: "tehnicheska-poddrazhka",
    publishedAt: "2026-10-24",
    updatedAt: "2026-10-24",
    readingMinutes: 9,
    relatedService: "maintenance",
    relatedServices: ["maintenance", "audit", "integrations"],
    relatedArticles: ["tehnicheski-seo-odit-na-online-magazin", "shopify-ili-woocommerce"],
    keyPoints: [
      "The most expensive problems rarely show an error message — the customer simply leaves.",
      "Updates without a staging environment and a check of the critical path are a major source of outages.",
      "Integrations with couriers, ERP and invoicing need a log and alerts when they stop.",
      "A backup whose restore has never been tested is not a recovery plan.",
      "A short monthly checklist catches most problems before customers notice them.",
    ],
    sections: [
      {
        heading: "Why small technical problems cost the most",
        paragraphs: [
          "When an online store goes down completely, someone notices within minutes. Silent faults are far more expensive: shipping calculation fails only for certain addresses, the confirmation email lands in spam, or the stock sync stops overnight. In most of these cases there is no error message — the customer just does not complete the order.",
          "That is why technical maintenance is not only about reacting to outages, but about regularly checking the places where losses stay invisible. Below are the eight areas that most often cause such problems, with the first check for each.",
        ],
        table: {
          caption: "Quick overview: problem, how it shows up and the first check",
          headers: ["Problem", "How it shows up", "First check"],
          rows: [
            ["Errors after updates", "Broken pages, blank screens, missing features", "Is there a staging environment and a list of recent changes?"],
            ["Slow categories and products", "High drop-off on mobile devices", "Speed measured by page type"],
            ["Cart problems", "Orders started but not completed", "A test order with different shipping and payment methods"],
            ["Broken integrations", "Wrong stock levels, missing shipping labels", "Log of the last successful sync"],
            ["Emails in spam", "Customers ask whether their order went through", "SPF, DKIM and DMARC records for the domain"],
            ["Duplicate content", "Indexed filter pages", "Indexing report in Search Console"],
            ["Untested backups", "Invisible — until the day of the outage", "When a backup was last restored"],
            ["Weak access control", "Shared accounts, former contractors with access", "List of administrators and two-factor authentication"],
          ],
        },
      },
      {
        heading: "1. Errors after platform, theme and extension updates",
        paragraphs: [
          "A WooCommerce store usually runs WordPress, WooCommerce, a theme and dozens of plugins, each with its own update cycle, plus the PHP version on the server. On Shopify the platform is updated centrally, but apps and the theme add their own code to the store. In both cases a seemingly harmless update can change how the cart or a template behaves.",
        ],
        bullets: [
          "Update in a staging environment — a copy of the live store — first.",
          "Update one component at a time so you know what caused a problem.",
          "After every update, walk through the critical path: product, cart, payment, confirmation email.",
          "Keep a short change log and a plan for rolling back to the previous version.",
        ],
      },
      {
        heading: "2. Slow category and product pages",
        paragraphs: [
          "Speed is rarely the same across the whole store. The homepage may be fast while categories with many products and filters, or product pages with galleries and reviews, load slowly. Measuring only the homepage gives a false picture.",
          "The most common causes are unoptimized images, scripts from apps that are no longer used, slow database queries when filtering, and hosting without caching.",
        ],
        bullets: [
          "Measure the homepage, a category, a product and the cart separately.",
          "Check Core Web Vitals in Search Console — that is where the real-visitor data is.",
          "Review the installed apps and plugins and remove the ones you no longer use.",
        ],
      },
      {
        heading: "3. Cart and checkout problems",
        paragraphs: [
          "The cart is where technical errors cost money most directly. Typical examples are incorrect shipping calculation for certain locations, coupons that conflict with sale prices, and payments where the customer is charged but the order stays \"pending\" because the notification from the payment provider was not processed.",
        ],
        bullets: [
          "Place a test order at least once a month and after every update — with different shipping and payment methods.",
          "Track the number of started but uncompleted payments and investigate sudden changes.",
          "Check that notifications from the payment provider (webhooks) arrive and are processed.",
        ],
      },
      {
        heading: "4. Broken integrations with couriers, warehouse and invoicing",
        paragraphs: [
          "Integrations usually run \"in the background\", so when they stop it is noticed late — when a customer orders an out-of-stock product or a shipping label is never created. Typical causes are a changed API key, an expired subscription, a change in the provider's API or a reached rate limit.",
          "A good integration records every sync and alerts a responsible person when a step fails, instead of stopping silently.",
        ],
        bullets: [
          "Know when the last successful sync happened for every integration.",
          "Set up an alert for a failed sync, not only for a complete outage.",
          "Keep access keys outside the code and document who manages them.",
        ],
        links: [{ label: "API integrations and monitoring", href: "/uslugi/api-integrations-cloud-security" }],
      },
      {
        heading: "5. Order emails that never reach customers",
        paragraphs: [
          "If customers often ask whether their order was received, check email deliverability. Sending directly from the web server without a properly configured domain often lands messages in spam.",
        ],
        bullets: [
          "Check the domain's SPF, DKIM and DMARC records.",
          "Use a dedicated transactional email service instead of sending from the server.",
          "Send a test order to addresses at different email providers.",
        ],
      },
      {
        heading: "6. Duplicate and unnecessarily indexed content",
        paragraphs: [
          "Filters and sorting in categories can create thousands of URLs with almost identical content. If they are indexed, the search engine spends its resources on them instead of on important categories and products. Out-of-stock products without a clear policy — whether the page stays, redirects or is removed — create a similar problem.",
        ],
        links: [{ label: "Technical SEO audit for online stores", href: "/statii/technical-seo-audit-for-online-stores" }],
      },
      {
        heading: "7. Backups that have never been restored",
        paragraphs: [
          "Almost every host offers backups, but few stores have checked whether they can actually restore the store from them — with the database, uploaded files and settings. A backup stored on the same server does not help if the problem is the server itself.",
        ],
        bullets: [
          "Keep at least one copy outside your main hosting.",
          "Test a restore in a staging environment at least once a quarter.",
          "Record how long the restore takes — that is your real readiness for an outage.",
        ],
      },
      {
        heading: "8. Weak access control and forgotten accounts",
        paragraphs: [
          "Over time, accounts of former employees, agencies and temporary contractors pile up in the store admin. Shared passwords and the lack of two-factor authentication turn every leaked credential into a risk for customer data.",
        ],
        bullets: [
          "Every person should have their own account with the minimum permissions required.",
          "Enable two-factor authentication for all administrators.",
          "Review the access list every quarter and remove what is no longer needed.",
        ],
      },
      {
        heading: "Turning the list into a monthly routine",
        paragraphs: [
          "Most of the checks above take minutes when done regularly. If you have no in-house technical team, the most practical option is a monthly maintenance plan with clearly defined checks, or a one-off technical audit that shows where to start.",
        ],
        bullets: [
          "A test order with different shipping and payment methods.",
          "A review of errors and warnings in Search Console.",
          "A check of the last successful sync for each integration.",
          "Planned updates in a staging environment.",
          "A review of the list of administrator accounts.",
        ],
        links: [
          { label: "Online store maintenance", href: "/uslugi/ecommerce-maintenance" },
          { label: "Technical audit of an online store", href: "/uslugi/technical-audit" },
        ],
      },
    ],
  },
  {
    key: "ai-avtomatizatsiya-v-malkiya-biznes",
    slug: "ai-automation-for-small-businesses",
    title: "How AI automation reduces manual work in small businesses",
    metaTitle: "AI automation for small businesses: where it helps and its limits",
    description:
      "A practical guide to AI automation for small businesses: which tasks are a good fit, how to estimate the benefit in advance and how to keep control of important decisions.",
    type: "guide",
    category: "avtomatizatsiya",
    publishedAt: "2026-10-24",
    updatedAt: "2026-10-24",
    readingMinutes: 8,
    relatedService: "automation",
    relatedServices: ["automation", "ai_tools", "integrations"],
    relatedArticles: ["avtomatizatsiya-s-choveshko-odobrenie", "ai-asistent-za-klienti"],
    keyPoints: [
      "AI is useful where the input is unstructured: emails, documents, free text.",
      "Classic automation is more reliable for rule-based tasks — the two complement each other.",
      "Estimate the benefit in advance: frequency × time × number of people, minus maintenance costs.",
      "Start with a limited pilot that runs alongside the manual process.",
      "Actions with an external effect — messages, prices, orders — keep human approval.",
    ],
    sections: [
      {
        heading: "The manual work that never shows up in reports",
        paragraphs: [
          "In a small business, much of the working day goes to tasks nobody ever designed on purpose: copying data from emails into spreadsheets, forwarding inquiries to the right colleague, retyping invoice data, preparing the same report every week. Each one looks insignificant, but together they push out work with customers and sales.",
          "The first step is not choosing a tool but describing these tasks: how often they happen, how long they take and what happens when they are delayed or done wrong.",
        ],
      },
      {
        heading: "Classic automation or AI automation",
        paragraphs: [
          "Classic automation follows rules: \"when an order arrives, create a task in the CRM\". It is reliable, fast and cheap to maintain, but it needs structured data. AI automation adds the ability to work with unstructured input — free text in an email, a scanned document, different phrasings of the same question.",
          "In practice the best solutions combine the two: AI recognizes and structures the input, and rules decide what happens next.",
        ],
        table: {
          caption: "When each kind of automation fits",
          headers: ["Criterion", "Classic automation", "AI automation"],
          rows: [
            ["Type of input", "Structured data, forms, events", "Free text, emails, documents"],
            ["Predictability", "Same input, same result", "Mistakes are possible — a check is needed"],
            ["Maintenance", "Low, as long as the rules do not change", "Quality needs to be evaluated over time"],
            ["Typical example", "New order → task in the CRM", "Incoming email → category, urgency, draft reply"],
          ],
        },
      },
      {
        heading: "Tasks that are usually a good fit",
        paragraphs: ["Good candidates are frequent, repetitive and have a clear criterion for whether the result is correct:"],
        bullets: [
          "Classifying incoming inquiries by topic and urgency and routing them to the right person.",
          "Extracting data from invoices and documents, checked by a staff member before it is saved.",
          "Drafting replies to frequent questions, which a staff member reviews and sends.",
          "Summarizing long email threads or documents.",
          "Drafting product descriptions to a set structure and tone.",
          "Weekly reports generated from real data, with a short explanation of anomalies.",
        ],
        links: [{ label: "Custom AI tools", href: "/uslugi/custom-ai-tools" }],
      },
      {
        heading: "Tasks that are not a good fit — at least for now",
        paragraphs: [
          "Not every task is worth automating. If a process happens rarely, every case is different, or a mistake is expensive and hard to correct, manual handling with good tools is often more sensible.",
        ],
        bullets: [
          "Decisions with legal or financial consequences without a human check.",
          "Processes that change every month and have no stable rules.",
          "Tasks where you cannot verify whether the result is correct.",
          "Tasks that happen a few times a year.",
        ],
      },
      {
        heading: "How to estimate the benefit before you start",
        paragraphs: [
          "A simple estimate is: how many times the task happens, how long it takes each time and how many people are involved. From that, subtract the time needed to check the automated result and the cost of development and maintenance.",
          "An illustrative (hypothetical) calculation: if classifying one inquiry takes about 3 minutes and happens 40 times per working day, that is about 2 hours a day. If, after automation, the staff member only checks the suggested category for 30 seconds, the manual work drops to about 20 minutes a day. The real values for your business must be measured before and after the pilot — they may turn out better or worse.",
        ],
        bullets: [
          "Measure the current time before you change the process.",
          "Include the time for checks and corrections, not only the time saved.",
          "Assess the cost of mistakes too — sometimes it matters more than time.",
        ],
      },
      {
        heading: "People stay in the process",
        paragraphs: [
          "The most common mistake is automating the whole process at once, including actions with an external effect. The safer approach is for automation to prepare the action — a draft, a proposal, a classification — and for a person to approve whatever reaches customers, prices or orders. Every decision is logged so the process can keep improving.",
        ],
        links: [{ label: "Human-in-the-loop automation", href: "/statii/human-in-the-loop-automation" }],
      },
      {
        heading: "Steps for a first pilot",
        paragraphs: ["A well-bounded pilot produces real data for a decision without much risk:"],
        bullets: [
          "Choose one task with a clear input, a clear output and measurable volume.",
          "Collect 30–50 real examples with the expected correct result.",
          "Run the automation alongside the manual process and compare the results.",
          "Set a quality threshold at which the automation takes over the task, with checks.",
          "Expand only once the pilot runs reliably.",
        ],
      },
      {
        heading: "Data and privacy",
        paragraphs: [
          "When automation processes emails, invoices or customer data, GDPR requirements apply. Send the AI provider only the data it needs, remove personal data when it is not required, sign a data processing agreement and describe the processing in your privacy policy.",
        ],
        links: [
          { label: "Business process automation", href: "/uslugi/business-process-automation" },
          { label: "AI for business", href: "/ai-resheniya" },
        ],
      },
    ],
  },
  {
    key: "shopify-ili-woocommerce",
    slug: "shopify-vs-woocommerce",
    title: "Shopify or WooCommerce: how to choose the right platform for your online store",
    metaTitle: "Shopify vs WooCommerce: how to choose a platform",
    description:
      "Shopify and WooCommerce compared for small and mid-sized stores: maintenance, costs, flexibility, security, SEO and integrations — and the questions to ask first.",
    type: "comparison",
    category: "platformi",
    publishedAt: "2026-10-24",
    updatedAt: "2026-10-24",
    readingMinutes: 9,
    relatedService: "maintenance",
    relatedServices: ["maintenance", "integrations", "seo"],
    relatedArticles: ["tehnicheski-problemi-pri-online-magazinite", "tehnicheski-seo-odit-na-online-magazin"],
    keyPoints: [
      "Shopify is a hosted service: less technical responsibility in exchange for less control.",
      "WooCommerce is open-source software on WordPress: full control in exchange for responsibility for hosting and maintenance.",
      "Compare the total cost over several years, not just the starting price.",
      "Check the courier, payment and invoicing integrations you need in advance.",
      "Switching platforms is possible but requires a careful URL migration for SEO.",
    ],
    sections: [
      {
        heading: "The short answer",
        paragraphs: [
          "There is no universally better platform. Shopify is usually the better choice when you want a fast start and minimal technical responsibility. WooCommerce is usually the better choice when you need full control, specific business logic or a strong connection to WordPress content — and you have a person or partner to maintain the store.",
          "Below are the criteria for comparing the two platforms for your specific case.",
        ],
      },
      {
        heading: "How the two platforms work",
        paragraphs: [
          "Shopify is a hosted platform (SaaS): you pay a subscription, and hosting, infrastructure security and core updates are Shopify's responsibility. Functionality is extended with apps from the app store and the design with themes written in the Liquid template language. Access to server-side code is limited.",
          "WooCommerce is a free, open-source plugin for WordPress. You choose the hosting and have full access to the code and database. Functionality is extended with plugins. The freedom is greater, but responsibility for updates, security, backups and speed is yours or your technical partner's.",
        ],
      },
      {
        heading: "Comparison on key criteria",
        paragraphs: [
          "The table summarizes the typical differences. Specific prices and terms change, so check current plans and fees directly with the providers.",
        ],
        table: {
          caption: "Shopify and WooCommerce — typical differences",
          headers: ["Criterion", "Shopify", "WooCommerce"],
          rows: [
            ["Hosting and infrastructure", "Included in the subscription", "You choose and pay for hosting separately"],
            ["Core updates", "Automatic, handled by Shopify", "Your responsibility, ideally tested in staging"],
            ["Getting started", "Fast, no technical setup", "Hosting, installation and configuration required"],
            ["Running costs", "Subscription, paid apps, payment fees", "Hosting, paid plugins, maintenance"],
            ["Flexibility", "Limited to what the platform and apps support", "Almost unlimited, with access to the code"],
            ["Content and blog", "Basic features", "Strong — WordPress is a content management system"],
            ["Security", "Infrastructure is Shopify's; apps are your choice", "Depends on hosting, updates and plugins"],
            ["Data ownership and portability", "Export through the admin and API", "Full access to the database"],
          ],
        },
      },
      {
        heading: "When Shopify is usually the better choice",
        paragraphs: [],
        bullets: [
          "You have no technical person and do not want to be responsible for hosting and updates.",
          "Your products and processes are standard and covered by the platform and its apps.",
          "A fast start and predictable monthly infrastructure costs matter most.",
          "You prefer centrally maintained payments and infrastructure over full control.",
        ],
      },
      {
        heading: "When WooCommerce is usually the better choice",
        paragraphs: [],
        bullets: [
          "You have specific logic — complex pricing, B2B terms, non-standard products.",
          "Content is an important part of your strategy and you already use WordPress.",
          "You want full control over the code, data and hosting.",
          "You have an in-house developer or a technical partner for regular maintenance.",
        ],
      },
      {
        heading: "Costs that are often overlooked",
        paragraphs: [
          "Comparing only the starting price is misleading. Calculate the total cost over two to three years, including:",
        ],
        bullets: [
          "Paid apps or plugins — many features are paid for separately and monthly.",
          "Payment fees: check which fees your chosen payment provider charges and whether the platform adds a fee when you use an external provider.",
          "Hosting, backups and monitoring for WooCommerce.",
          "A paid theme and its updates.",
          "Time for maintenance, updates and troubleshooting — in-house or by a partner.",
        ],
      },
      {
        heading: "Local integrations: couriers, payments and invoicing",
        paragraphs: [
          "For a store selling in Bulgaria and other EU markets, check the integrations with your couriers, payment providers and invoicing system or ERP in advance. Both platforms have extensions for local services, but their availability, quality and maintenance vary. Check who maintains the extension, when it was last updated and whether there is an API for cases it does not cover.",
        ],
        links: [{ label: "API integrations for online stores", href: "/uslugi/api-integrations-cloud-security" }],
      },
      {
        heading: "Questions to ask before deciding",
        paragraphs: [],
        bullets: [
          "Who will be responsible for technical maintenance after launch?",
          "Which integrations are required from day one?",
          "Do you have non-standard rules for pricing, shipping or stock?",
          "How important is content (articles, guides) for attracting customers?",
          "What is a realistic budget for the first two to three years, including maintenance?",
        ],
      },
      {
        heading: "If you already have a store: migration",
        paragraphs: [
          "Switching platforms is possible, but it is a project in its own right. Beyond moving products, customers and orders, the biggest risk to organic traffic is changing URLs. You need a complete redirect map from old to new URLs, carried-over titles, descriptions and structured data, and a check in Search Console after launch.",
        ],
        links: [
          { label: "Technical SEO audit for online stores", href: "/statii/technical-seo-audit-for-online-stores" },
          { label: "Online store maintenance", href: "/uslugi/ecommerce-maintenance" },
        ],
      },
    ],
  },
];
