"""English templates for the deterministic advisor demo (see `advisor_mock.py`).

Same pattern keys, structure and rules as the Bulgarian templates; only the wording differs.
Keywords are English so descriptions written in English are matched too.
"""

from __future__ import annotations

from typing import Any

from app.advisor.schemas import ToolKey
from app.ai.advisor_template_base import ProcessPattern, approval, opp, risk, step

PATTERNS: dict[str, ProcessPattern] = {
    p.key: p
    for p in [
        ProcessPattern(
            key="invoices",
            label="invoicing and payments",
            keywords=("invoice", "accounting", "bookkeep", "payment", "bank", "expense", "receipt"),
            uses_ai=True,
            opportunities=[
                opp(
                    "Automatic data extraction from incoming invoices",
                    "Incoming invoices (PDFs or photos) are recognised, and supplier, number, date and amounts are "
                    "filled into a draft for review instead of being typed in by hand.",
                    "ai_assisted",
                    "high",
                ),
                opp(
                    "Matching payments to invoices",
                    "Bank transactions are compared with open invoices by rules (number, amount, counterparty), "
                    "and mismatches are collected in a list for review.",
                    "rules",
                    "medium",
                ),
            ],
            workflow=[
                step("Collecting the documents", "Invoices arrive in a single mailbox or folder.", "system"),
                step(
                    "Extracting the data",
                    "An AI model reads the document and prepares a draft with the fields and a confidence level "
                    "for each field.",
                    "ai",
                ),
                step(
                    "Reviewing the draft",
                    "A team member reviews low-confidence fields and corrects them where needed.",
                    "human",
                    True,
                ),
                step(
                    "Recording in the accounting software",
                    "The approved invoice is recorded in the accounting system through an integration.",
                    "system",
                    True,
                ),
                step("Mismatch report", "A weekly list of unpaid and unmatched documents.", "system"),
            ],
            approvals=[
                approval("Booking an invoice", "A wrong amount or counterparty ends up in the accounts."),
                approval("Every payment order", "The automation never moves money on its own."),
            ],
            risks=[
                risk(
                    "Inaccurate recognition of scanned or non-standard documents.",
                    "A confidence threshold with mandatory human review below it.",
                ),
            ],
            data_protection=["Invoices contain counterparty data — access is limited to the accounting team."],
            questions=[
                "In what format do you receive invoices (PDF by email, paper, supplier portal)?",
                "Which accounting software do you use, and does it have an API or file import?",
            ],
        ),
        ProcessPattern(
            key="orders",
            label="order processing and delivery",
            keywords=(
                "order",
                "deliver",
                "courier",
                "shipping",
                "shipment",
                "warehouse",
                "stock",
                "inventory",
                "waybill",
                "parcel",
            ),
            uses_ai=False,
            opportunities=[
                opp(
                    "Automatic creation of shipping labels",
                    "Once an order is confirmed, the delivery details are passed to the courier service and the "
                    "tracking number is returned to the order.",
                    "integration",
                    "high",
                ),
                opp(
                    "Stock synchronisation",
                    "Stock levels between the store and the warehouse or ERP are updated on a schedule or on an "
                    "event, so items that are out of stock are not sold.",
                    "integration",
                    "medium",
                ),
            ],
            workflow=[
                step("New order", "The store emits an event (webhook) for a new or paid order.", "system"),
                step(
                    "Rule checks",
                    "Address, stock and payment method are checked; suspicious orders are flagged.",
                    "system",
                ),
                step(
                    "Reviewing flagged orders",
                    "A team member decides what happens to orders that do not pass the checks.",
                    "human",
                    True,
                ),
                step(
                    "Creating the shipment",
                    "The shipment is created with the courier after the order has been approved.",
                    "system",
                    True,
                ),
                step(
                    "Notifying the customer",
                    "The customer receives a tracking number using a template you approved in advance.",
                    "system",
                    True,
                ),
            ],
            approvals=[
                approval("Rejecting, changing or cancelling an order", "It affects the customer and the payment."),
                approval("The wording of automatic messages to customers", "Templates are approved before launch."),
            ],
            risks=[
                risk(
                    "Wrong delivery details are passed to the courier automatically.",
                    "Address validation and manual review of orders with a warning.",
                ),
                risk(
                    "The connection to the courier or warehouse goes down.",
                    "A queue with retries and an alert to the responsible team member.",
                ),
            ],
            data_protection=["Customer addresses and phone numbers are shared only with the chosen courier."],
            questions=[
                "Which couriers do you work with, and do you use their online account or API?",
                "Where are stock levels kept — in the store, in a spreadsheet or in an ERP?",
            ],
        ),
        ProcessPattern(
            key="customer_inquiries",
            label="answering customer inquiries",
            keywords=(
                "inquir",
                "enquir",
                "email",
                "question",
                "complaint",
                "return",
                "chat",
                "whatsapp",
                "phone call",
                "support",
                "customer",
            ),
            uses_ai=True,
            opportunities=[
                opp(
                    "Classifying and routing inquiries",
                    "Incoming messages are sorted by topic and urgency so they reach the right person.",
                    "ai_assisted",
                    "high",
                ),
                opp(
                    "Draft replies from your knowledge base",
                    "For frequent questions, AI prepares a draft reply based on texts you have approved; a team "
                    "member edits it and sends it.",
                    "ai_assisted",
                    "medium",
                ),
            ],
            workflow=[
                step("Collecting messages", "Email, the contact form and chat are combined into one queue.", "system"),
                step("Classification", "AI determines the topic, urgency and language of the message.", "ai"),
                step(
                    "Draft reply",
                    "For standard topics, AI prepares a draft with sources from the knowledge base.",
                    "ai",
                ),
                step("Review and sending", "A team member checks, edits and sends the reply.", "human", True),
                step("Feedback", "Rejected drafts are used to improve the knowledge base.", "human"),
            ],
            approvals=[
                approval("Sending any reply to a customer", "AI does not send messages on your behalf."),
                approval("Promises of discounts, refunds or deadlines", "Only a team member can commit to them."),
            ],
            risks=[
                risk(
                    "AI suggests an inaccurate or made-up answer.",
                    "Answers only from an approved knowledge base and mandatory human review.",
                ),
            ],
            data_protection=[
                "Customer messages are masked (names, phone numbers, emails) before an AI model processes them.",
            ],
            questions=[
                "What are the five most frequent questions you receive?",
                "Do you have written policies for returns, delivery and complaints?",
            ],
        ),
        ProcessPattern(
            key="reporting",
            label="reporting and data consolidation",
            keywords=("report", "excel", "spreadsheet", "analys", "dashboard", "summar", "kpi"),
            uses_ai=False,
            opportunities=[
                opp(
                    "Automatic recurring reports",
                    "Data is collected from the sources on a schedule and the report is produced in the same "
                    "format every time, instead of being copied by hand between spreadsheets.",
                    "reporting",
                    "high",
                ),
                opp(
                    "A dashboard with key metrics",
                    "One dashboard with the data that is currently looked up in several systems, updated "
                    "automatically.",
                    "reporting",
                    "medium",
                ),
            ],
            workflow=[
                step("Extracting the data", "Data is pulled from the sources via API or export.", "system"),
                step("Checking and cleaning", "Duplicates and missing values are flagged by rules.", "system"),
                step(
                    "Producing the report",
                    "The report is built from a template and saved to an internal folder.",
                    "system",
                ),
                step("Reviewing deviations", "A responsible team member reviews the flagged deviations.", "human"),
            ],
            approvals=[
                approval(
                    "Changing formulas and metric definitions",
                    "Otherwise reports stop being comparable over time.",
                ),
            ],
            risks=[
                risk(
                    "Different definitions of the same metric in different systems.",
                    "A written definition of every metric before automating.",
                ),
            ],
            questions=[
                "Which reports do you prepare most often, and who uses them?",
                "How many systems or spreadsheets does the data for one report come from?",
            ],
        ),
        ProcessPattern(
            key="catalog",
            label="product catalogue maintenance",
            keywords=("product", "descript", "photo", "image", "catalog", "sku", "attribute", "translat"),
            uses_ai=True,
            opportunities=[
                opp(
                    "Draft product descriptions",
                    "AI prepares descriptions and attributes in your style from the product's technical data; an "
                    "editor approves them before they go live.",
                    "ai_assisted",
                    "high",
                ),
                opp(
                    "Bulk import from supplier files",
                    "Supplier files are converted automatically to the structure of your store.",
                    "integration",
                    "medium",
                ),
            ],
            workflow=[
                step("Receiving the data", "Price lists and specifications arrive as a file or via API.", "system"),
                step("Conversion", "Fields are mapped to the store's structure by rules.", "system"),
                step("Content draft", "AI suggests a description and attributes for new products.", "ai"),
                step("Editing and approval", "An editor checks the texts and data.", "human", True),
                step("Going live", "Approved products are published in the store.", "system", True),
            ],
            approvals=[
                approval("Publishing products and changing prices", "A wrong price or description affects customers."),
            ],
            risks=[
                risk(
                    "Inaccurate technical specifications in the generated text.",
                    "Generation only from the supplied data and review by an editor.",
                ),
            ],
            questions=["How many new products do you add each month, and from how many suppliers?"],
        ),
        ProcessPattern(
            key="bookings",
            label="bookings and schedules",
            keywords=("booking", "reservation", "schedul", "calendar", "appointment", "shift", "rota"),
            uses_ai=False,
            opportunities=[
                opp(
                    "Online booking with rules for available slots",
                    "Customers pick a free slot, and the system applies your rules for duration and breaks.",
                    "rules",
                    "high",
                ),
                opp(
                    "Automatic reminders",
                    "Customers receive a reminder using an approved template, which reduces missed appointments.",
                    "rules",
                    "medium",
                ),
            ],
            workflow=[
                step("Booking request", "The customer chooses a service and a free slot.", "system"),
                step("Rule check", "The system checks the schedule and any conflicts.", "system"),
                step("Confirmation", "In special cases a team member confirms manually.", "human", True),
                step("Reminder", "A reminder is sent using an approved template.", "system", True),
            ],
            approvals=[approval("Changing or cancelling a confirmed booking", "It directly affects the customer.")],
            risks=[
                risk(
                    "Double bookings when changes are made by hand outside the system.",
                    "One calendar as the single source of truth for all channels.",
                ),
            ],
            questions=["How do you take bookings today — by phone, messages or online?"],
        ),
        ProcessPattern(
            key="documents",
            label="data entry from documents",
            keywords=(
                "data entry", "manual entry", "copy", "document", "pdf", "contract", "scan", "paper form", "retyp"
            ),
            uses_ai=True,
            opportunities=[
                opp(
                    "Extracting data from documents",
                    "Data in documents is recognised and filled into a structured form for review, instead of "
                    "being retyped by hand.",
                    "ai_assisted",
                    "high",
                ),
                opp(
                    "Completeness checks",
                    "Rules check that all mandatory fields and attachments are present before a document moves on.",
                    "rules",
                    "medium",
                ),
            ],
            workflow=[
                step("Receiving the document", "The document arrives by email, upload or scanner.", "system"),
                step("Recognition", "AI extracts the fields and marks uncertain values.", "ai"),
                step("Review", "A team member confirms or corrects the uncertain fields.", "human", True),
                step("Recording", "Confirmed data is recorded in the target system.", "system", True),
            ],
            approvals=[approval("Recording the data in the main system", "It stops errors from spreading.")],
            risks=[
                risk(
                    "Sensitive data in the documents.",
                    "Only the minimum necessary fields, encrypted storage and restricted access.",
                ),
            ],
            data_protection=["Documents are kept only for as long as processing requires."],
            questions=["What kinds of documents do you process, and how many different layouts are there?"],
        ),
        ProcessPattern(
            key="sales",
            label="quote requests and sales handling",
            keywords=("quote", "quotation", "sales", "crm", "lead", "prospect", "tender", "follow-up", "follow up"),
            uses_ai=True,
            opportunities=[
                opp(
                    "Automatic logging of inquiries in the CRM",
                    "Inquiries from the website, email and phone are recorded in one place with source and status.",
                    "integration",
                    "high",
                ),
                opp(
                    "Template-based quote drafts",
                    "AI fills a quote template from the customer's description; the salesperson reviews and "
                    "completes it.",
                    "ai_assisted",
                    "medium",
                ),
            ],
            workflow=[
                step("New inquiry", "The inquiry is recorded in the CRM with source and topic.", "system"),
                step("Summary", "AI summarises the customer's need and suggests a next step.", "ai"),
                step("Quote draft", "The template is filled with the details from the inquiry.", "ai"),
                step("Review and sending", "A salesperson checks the terms and sends the quote.", "human", True),
                step("Follow-up reminder", "The system reminds the salesperson when there is no reply.", "system"),
            ],
            approvals=[approval("Sending a quote and terms to a customer", "Commercial terms are a commitment.")],
            risks=[
                risk(
                    "Incomplete information in an automatically filled quote.",
                    "Mandatory fields and a review by a salesperson before sending.",
                ),
            ],
            questions=["How do you track the status of quotes today?"],
        ),
    ]
}

GENERAL = ProcessPattern(
    key="general",
    label="repetitive manual work",
    keywords=(),
    uses_ai=False,
    opportunities=[
        opp(
            "Mapping and standardising the process",
            "Before automating, the process is described step by step to show the repetitive actions and the "
            "places where information gets lost.",
            "rules",
            "high",
        ),
        opp(
            "Automating data transfer",
            "Data that is copied by hand between systems today is transferred automatically by rules.",
            "integration",
            "medium",
        ),
    ],
    workflow=[
        step("Process start", "An event or a schedule starts the process.", "system"),
        step("Rule-based processing", "Standard cases are processed automatically.", "system"),
        step("Exceptions", "Non-standard cases are routed to a team member.", "human", True),
        step("Result and log", "The result is recorded in a shared log.", "system"),
    ],
    approvals=[approval("Handling exceptions", "Non-standard cases require human judgement.")],
    risks=[
        risk(
            "The description does not give enough information about the specific steps.",
            "A short working session and a review of real examples before any decision.",
        ),
    ],
    questions=["Describe the steps of the process from start to finish — who does what, and in which system?"],
)

TOOL_INTEGRATIONS: dict[ToolKey, tuple[str, str, str]] = {
    ToolKey.SHOPIFY: ("Shopify", "Orders, products and customers via the Admin API and webhooks.", "read_write"),
    ToolKey.WOOCOMMERCE: ("WooCommerce", "Orders and products via the REST API and webhooks.", "read_write"),
    ToolKey.OTHER_ECOMMERCE: ("E-commerce platform", "Orders and products, if the platform has an API.", "read_write"),
    ToolKey.SPREADSHEETS: ("Excel / Google Sheets", "Interim data source or report output.", "read_write"),
    ToolKey.GOOGLE_WORKSPACE: ("Google Workspace", "Gmail, Drive and Calendar as input channels.", "read"),
    ToolKey.MICROSOFT_365: ("Microsoft 365", "Outlook, SharePoint and OneDrive as input channels.", "read"),
    ToolKey.EMAIL: ("Email", "Incoming messages and documents.", "read"),
    ToolKey.CRM: ("CRM", "Recording contacts, inquiries and statuses.", "read_write"),
    ToolKey.ERP: ("ERP", "Stock, orders and documents.", "read_write"),
    ToolKey.ACCOUNTING: ("Accounting software", "Importing approved documents.", "write"),
    ToolKey.INVOICING: ("Invoicing software", "Issuing invoices after approval.", "write"),
    ToolKey.COURIER: ("Courier API", "Creating shipments and tracking.", "read_write"),
    ToolKey.PAYMENTS: ("Payment provider", "Read-only access to payment status.", "read"),
    ToolKey.HELPDESK: ("Helpdesk system", "Tickets, tags and draft replies.", "read_write"),
    ToolKey.MESSAGING: ("Viber / WhatsApp / Messenger", "Incoming messages via the official business APIs.", "read"),
}

BASE_DATA_PROTECTION = [
    "Only the data the process needs is processed (data minimisation under the GDPR).",
    "If an external AI provider is used, a data processing agreement and a check of where the data is "
    "processed are required.",
    "The automation accesses each system through a separate account with minimal permissions.",
]
BASE_RISKS = [
    risk(
        "The automation keeps running on outdated rules after the process has changed.",
        "A process owner and a review of the rules every few months.",
    ),
]
NEXT_STEPS = [
    "Collect 5–10 real examples of the process (without personal data), including difficult cases.",
    "Decide who in the team owns the process and approves changes.",
    "Check which of the systems you use have an API or at least file import and export.",
    "Discuss the assessment with us — we agree the scope first, then propose a written quote.",
]

PHASES: dict[str, list[dict[str, Any]]] = {
    "low": [
        {
            "name": "Clarification",
            "description": "Review of real examples and a written description of the rules.",
            "deliverables": ["Process description", "List of rules and exceptions"],
            "indicative_duration": "3–5 working days",
        },
        {
            "name": "Pilot automation",
            "description": "Automation of the standard case with manual handling of exceptions.",
            "deliverables": ["Working pilot", "Log of processed cases"],
            "indicative_duration": "1–2 weeks",
        },
        {
            "name": "Rollout",
            "description": "Team training and monitoring in day-to-day work.",
            "deliverables": ["Short guide", "Owner and procedure for errors"],
            "indicative_duration": "up to 1 week",
        },
    ],
    "medium": [
        {
            "name": "Process analysis",
            "description": "Mapping the steps, systems and decisions that require a person.",
            "deliverables": ["Process map", "List of integrations and required access"],
            "indicative_duration": "about 1 week",
        },
        {
            "name": "Prototype",
            "description": "A prototype on real, anonymised examples with accuracy measured.",
            "deliverables": ["Prototype", "Results on the test examples"],
            "indicative_duration": "2–3 weeks",
        },
        {
            "name": "Integrations and testing",
            "description": "Connecting the systems, approval steps and error handling.",
            "deliverables": ["Integrations", "Tests", "Audit log"],
            "indicative_duration": "2–4 weeks",
        },
        {
            "name": "Launch and monitoring",
            "description": "Gradual launch and adjustments based on feedback.",
            "deliverables": ["Launch plan", "Monitoring and alerts"],
            "indicative_duration": "about 2 weeks",
        },
    ],
    "high": [
        {
            "name": "Analysis and mapping",
            "description": "Detailed analysis of the process, participants, data and exceptions.",
            "deliverables": ["Process map", "Data and risk assessment"],
            "indicative_duration": "1–2 weeks",
        },
        {
            "name": "Architecture and security",
            "description": "Choice of architecture, access rights, data storage and audit.",
            "deliverables": ["Technical architecture", "Permission model", "GDPR assessment"],
            "indicative_duration": "1–2 weeks",
        },
        {
            "name": "Phased development",
            "description": "Development in stages, with each stage released on its own.",
            "deliverables": ["Integrations", "Approval steps", "Automated tests"],
            "indicative_duration": "4–8 weeks",
        },
        {
            "name": "Parallel run and launch",
            "description": "The new process runs alongside the old one until the results match.",
            "deliverables": ["Comparison of results", "Final launch plan"],
            "indicative_duration": "2–4 weeks",
        },
    ],
}

TEXT = {
    "spreadsheet_title": "Less manual copying between spreadsheets",
    "spreadsheet_description": (
        "Spreadsheets that are filled in by hand today are fed automatically from the main system."
    ),
    "storage_system": "Central data store",
    "storage_purpose": "One place (a database or spreadsheet) the automation reads from and writes to.",
    "volume_question": "Are there peak periods, and how quickly must each case be processed?",
    "other_tools_question": "What integration options do the other systems you listed offer?",
    "owner_question": "Who will be responsible for approvals and for reviewing exceptions?",
    "label_joiner": " and ",
    "summary": (
        "Business: {business}; team: {team}; volume: {volume}. Based on the keywords in the description, the "
        "process relates to {labels}. Your description: “{excerpt}”"
    ),
    "reason_areas": "the process spans more than one area",
    "reason_writes": "it integrates with systems where business data is recorded",
    "reason_volume": "the volume requires reliable error handling and retries",
    "reason_team": "more participants means more roles and access rights",
    "reason_ai": "some steps require AI with human review",
    "reason_no_tools": "no systems were listed, so the first step is choosing where the data will be kept",
    "reason_default": "the process is clearly bounded and uses few systems",
    "level_low": "Low",
    "level_medium": "Medium",
    "level_high": "High",
    "complexity": "{level} complexity, because {detail}.",
}
