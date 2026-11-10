# Legal source package for the Bulgarian lawyer

Status: **a research aid, not legal advice and not a legal conclusion.** It lists, for each point the implementation
depends on, what the system does, the wording it affects, the official source and what was and was not verified. Where
an official Bulgarian provision could not be read, it says so; no text was changed on the strength of uncertain research.

How the sources were read (2026-11-10): the EUR-Lex pages and the State Gazette page below were opened and their
content was extracted by an automated reader (WebFetch). That is enough to point the lawyer to the right provision, not
to rely on it: **the lawyer must read the Official Journal and State Gazette text itself.** Secondary commentary (law-firm
and vendor articles found by search) is listed only as context and is not relied on.

Legend: **VERIFIED (extract)** = the provision was found on the official page and paraphrased by the reader;
**NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** = not read from an official Bulgarian source.

## 1. Consumer withdrawal and the withdrawal function

| Point | Implemented behaviour | Wording affected | Official source and provision | Open question for the lawyer |
| --- | --- | --- | --- | --- |
| 14 days, no reason | A consumer can submit a withdrawal statement; the system reads the period as 14 days from the day the checkout completed and shows a first reading only | Subscription terms (withdrawal section), withdrawal page, withdrawal screen | Directive 2011/83/EU Art. 9(1), 9(2)(a) (services: from the day of conclusion), EUR-Lex CELEX 32011L0083. **VERIFIED (extract)** | What is "the day of conclusion" for a subscription started online: the checkout, the first payment, or activation? Which Bulgarian article carries it (NOT VERIFIED) |
| Unequivocal statement | The statement is free text, recorded as written | Withdrawal screen, e-mail | Art. 11(1)–(2) **VERIFIED (extract)** | Is a free-text statement enough alongside the function? |
| Online function and its labels | Button "Откажете се от договора тук" / "Withdraw from contract here"; confirmation "Потвърждавам отказа" / "Confirm withdrawal"; the confirm step shows the account name and the e-mail the acknowledgement goes to | Withdrawal screen | Directive 2011/83/EU Art. 11a(1)–(3) inserted by Directive (EU) 2023/2673 Art. 1(3), CELEX 32023L2673; applies from 19 June 2026 (Art. 2(1)). **VERIFIED (extract)**. Bulgaria: Закон за изменение и допълнение на ЗЗП, State Gazette No. 87 of 24 September 2026 (adopted 10 September 2026), new **Чл. 52а ЗЗП**: function marked "откажете се от договора тук", confirmation function "потвърждавам отказа" or an equally unambiguous phrase. https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=245888 — **official source located; the text was read by an automated reader. Interpretation: NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** | Does the function have to be "prominently displayed" on every page during the period, not only in the account area? Is a login before the function acceptable? Must a guest checkout have it too? |
| Acknowledgement on a durable medium | A confirmation e-mail with the reference, submission time, purchase and statement is queued and dispatched at once; a failure is retried | Withdrawal e-mail text, subscription terms | Directive Art. 11a(4) ("without undue delay", content and date and time). Чл. 52а, para. 5: on a durable medium, reported as "no later than the end of the working day" (same official source). **Interpretation: NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** | Does the e-mail satisfy "durable medium"? How is "end of the working day" counted for a weekend submission? The system has no working-day logic: it sends at once or retries |
| Timely if submitted in time | The statement time is recorded; the system never rejects a statement | Terms | Art. 11a(5) **VERIFIED (extract)**; Чл. 52а, para. 6 (same official source). **Interpretation: NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** | — |
| Refund within 14 days | Staff decide; a refund is made by hand in Stripe and its reference recorded; nothing is automatic | Terms, withdrawal page | Art. 13(1) (without undue delay and within 14 days of being informed). **VERIFIED (extract)** | Who calculates the deadline, and how is the proportionate amount (below) deducted? |
| Early start of services, proportionate payment | A separate, unticked consumer-only checkbox is recorded; no amount is calculated by the system | Order review (early-start wording), terms | Art. 8(8) (express request), Art. 14(3) (proportionate share), Art. 14(4)(a) (no payment if the trader did not give the Art. 6(1)(h)/(j) information or the request was not made). **VERIFIED (extract)** | Is the wording of the early-start request sufficient? Does the order review give the Art. 6(1)(h) information? The current Bulgarian articles on early start and proportionate payment are **NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** (the State Gazette act found changes only the new Чл. 52а and financial services Чл. 59г–59д) |
| Exception for fully performed services and digital content | None implemented; the terms say exceptions apply only where the law provides | Terms | Art. 16(a), 16(m). **VERIFIED (extract)** | Does any plan fall under 16(a) or 16(m)? |
| Confirmation of the contract | Not separately implemented; the Stripe payment page and the account show the order | — | Art. 8(7) (durable medium, within a reasonable time) **VERIFIED (extract)** | Is a separate contract confirmation e-mail required before the service starts? |
| Ordinary cancellation vs withdrawal | "Управление на абонамента" (Stripe portal) stops future payments; withdrawal is a separate action | Withdrawal screen, terms | Not a statutory distinction in the sources read | Confirm the wording that separates them |

## 2. Prices and language (geo-blocking)

| Point | Implemented | Source | Open question |
| --- | --- | --- | --- |
| One price list for all languages | `ACTIVE_PRICE_SCHEDULE = "bg"` shown in BG and EN; the EU schedule is kept but shown nowhere | Regulation (EU) 2018/302 Art. 2(14) (net sale prices are "general conditions of access"), Art. 3, Art. 4(1) (no different conditions for nationality, residence or establishment in the three listed situations), Art. 4(2) (differences between territories are allowed if offered non-discriminatorily), Art. 1(2) (purely internal situations). CELEX 32018R0302. **VERIFIED (extract)** | Is a price that depends on the page language caught by Art. 4? Is a separately approved, openly stated list by the contracting party's country acceptable? The owner has not approved the single list (docs/PRICING.md) |

## 3. Personal data

| Point | Implemented | Source | Open question |
| --- | --- | --- | --- |
| Lawful bases documented | Contract/pre-contract (accounts, billing, inquiries), legal obligation (accounting), consent (marketing), legitimate interest (security, statistics) | GDPR Art. 6(1) (a)–(f), CELEX 32016R0679. **VERIFIED (extract)** | Is each assignment correct? Legitimate-interest balancing for audit and statistics |
| Consent: separate, optional, withdrawable | Separate unticked checkbox; consent and withdrawal recorded with the wording version; withdrawal by profile toggle, staff, or a link | GDPR Art. 4(11) (voluntary, specific, informed, clear affirmative act, no pre-ticked boxes), Art. 7(1) (proof), 7(2) (distinguishable), 7(3) (withdrawal as easy as giving), 7(4) (conditionality). **VERIFIED (extract)** | Is a link in each marketing message plus the profile toggle "as easy as giving"? The system sends no marketing e-mail; the sender and the content are outside this repository |
| Direct marketing objection | Withdrawal removes marketing eligibility; no other profiling exists | GDPR Art. 21(2)–(4). **VERIFIED (extract)** | Wording of the first-contact notice |
| E-mail marketing rules | No automatic marketing e-mail is sent | Directive 2002/58/EC Art. 13(1)–(4) (prior consent; the existing-customer exception; no concealed sender). **VERIFIED (extract)** (original 2002 text read; the amendments were not) | Which Bulgarian provision applies (ЗЕЕТ or ЗЗЛД): **NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** |
| Information to give | The privacy policy lists controller, purposes, bases, recipients, retention, rights, complaint, mandatory or not | GDPR Art. 13(1)–(2). **VERIFIED (extract)** | Completeness; the controller's contact point and whether a DPO is needed |
| Access and portability | JSON export of the person's own data | GDPR Art. 15, Art. 20. **VERIFIED (extract)** | Is the export complete for Art. 15 (all categories and recipients)? |
| Erasure and its limit | Deletion if nothing financial exists, anonymisation if accounting records do; refused while a subscription is not final | GDPR Art. 17(1), 17(3)(b) (legal obligation). **VERIFIED (extract)** | The Bulgarian retention duty and its period (accounting) — **NOT VERIFIED — BULGARIAN LAWYER AND ACCOUNTANT MUST CONFIRM** |
| One month to respond | Requests are queued for staff; there is no deadline timer in the system | GDPR Art. 12(3). Not extracted in this pass | **NOT VERIFIED** (the Article was not in the part of the text read); the owner needs a process that answers within the legal time |
| Storage limitation | Retention periods per record type; the legal-request periods are NOT approved (docs/LEGAL_RETENTION.md) | GDPR Art. 5(1)(e). **VERIFIED (extract)** | Periods for withdrawal and data requests |
| Controller/processor and Article 28 | The company is controller for its own site data and processor for a customer's data in managed services; a template schedule exists (docs/legal-templates/DPA_ART28_TEMPLATE.md) | GDPR Art. 28(1)–(3) (sufficient guarantees; authorisation for sub-processors; binding contract with the listed content). **VERIFIED (extract)** | Classification of each flow; the sub-processor list; the EDPB guidelines on controller and processor were not consulted — **NOT VERIFIED** |

## 4. Cookies and browser storage

| Point | Implemented | Source | Open question |
| --- | --- | --- | --- |
| Storage on the terminal equipment | Cookies and session storage listed in the cookie policy; no consent banner (no optional technology) | Directive 2002/58/EC Art. 5(3): clear and comprehensive information and a right to refuse, with an exemption for storage strictly necessary for a service the user explicitly requested. **VERIFIED (extract)** (original 2002 text) | Whether `acs_locale`, `acs_cookie_notice` and the sign-in cookies fall under the exemption: **not classified in the policy**; the lawyer decides. The Bulgarian transposition and КЗЛД/EDPB guidance were not read — **NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** |

## 5. Bulgarian national provisions not read from an official source

The following were **not** read from the State Gazette or another official Bulgarian source in this pass and must be
confirmed by the lawyer before any text relies on them: the articles of the Consumer Protection Act (ЗЗП) on the
withdrawal period, its start for services, early start, the proportionate amount, exceptions and the refund; the
Electronic Commerce Act (ЗЕТ) information duties; the Personal Data Protection Act (ЗЗЛД) provisions on children,
marketing and the supervisory authority's guidance (КЗЛД); the Accountancy Act and the Tax and Social Insurance
Procedure Code on retention; the Value Added Tax Act on invoices. A search found a draft amendment to the ЗЗП on
https://www.strategy.bg/bg/public-consultations/12187 (consultation until 29 March 2026); the **adopted** act is the State
Gazette No. 87/2026 above.

## 6. Context only (secondary, not relied on)

Law-firm and vendor articles about the withdrawal button (found by search, 2026-11-10) agreed with the Directive's
date and scope; they are not authority.
