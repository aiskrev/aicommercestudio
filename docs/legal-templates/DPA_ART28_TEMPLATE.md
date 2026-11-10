# Data processing schedule (Article 28 GDPR) — template

> **DRAFT. NOT REVIEWED BY A LAWYER.** The privacy policy says a data processing agreement is available on
> request when the Provider processes personal data on a customer's behalf (AI Managed Services, maintenance with
> access to personal data). This template follows the content list of Article 28(3) of Regulation (EU) 2016/679
> and must be reviewed by a lawyer before it is sent to anyone. Placeholders in `[…]` are filled per customer.

Parties: the Customer is the **controller**; Iskrev Consulting Ltd. ("ИСКРЕВ КОНСУЛТИНГ" ЕООД), UIC 207509557, is
the **processor**. If the Customer is itself a processor for its own client, say so and add the chain of
instructions.

## 1. Subject matter, duration, nature and purpose

* Subject matter and services this schedule belongs to: `[agreement and date]`.
* Duration: for as long as the processor has access to the personal data under that agreement, and until it is
  returned or deleted under section 8.
* Nature of the processing: `[hosting access, monitoring, logging review, prompt and model operation, support,
  backup handling — keep only what is true]`.
* Purpose: only to provide the services in the agreement.

## 2. Categories of data and of data subjects

* Types of personal data: `[contact data, order and customer data, support messages, technical identifiers,
  content sent to AI features — list what the processor can actually see]`.
* Special categories (Article 9) or data about criminal convictions: `[none expected / describe]`. If any, stop and
  ask a lawyer.
* Data subjects: `[the Customer's customers, staff, website visitors, …]`.

## 3. Processor obligations (Article 28(3))

The processor:

1. processes the data only on the controller's documented instructions, including for transfers outside the EEA,
   unless the law requires otherwise (it then tells the controller first, unless the law forbids it);
2. ensures that people authorised to process the data are bound by confidentiality;
3. takes the security measures required by Article 32 — see section 5;
4. respects the conditions for engaging another processor — see section 6;
5. assists the controller, by appropriate technical and organisational measures and as far as possible, to answer
   requests from data subjects (access, correction, erasure, restriction, portability, objection);
6. assists the controller with Articles 32–36 (security, breach notification, impact assessments, prior
   consultation), taking into account the nature of the processing and the information it has;
7. at the controller's choice, deletes or returns all the personal data at the end of the services and deletes
   existing copies unless the law requires storage — see section 8;
8. makes available the information needed to show compliance and allows and contributes to audits, including
   inspections by the controller or its auditor — see section 9; and tells the controller at once if it thinks an
   instruction breaches data protection law.

## 4. Personal data breaches

The processor tells the controller without undue delay after becoming aware of a breach affecting the controller's
data, within `[period agreed in the contract]`, with what it knows: nature, categories and approximate numbers,
likely consequences, measures taken, a contact point. It helps the controller meet its own duty to notify the
supervisory authority and data subjects.

## 5. Security measures (Article 32)

Describe what is actually in place; delete what is not. Starting list: access by named people with individual
accounts and multi-factor authentication where the system supports it; least privilege; encryption in transit;
backups with a stated retention; logging of administrative access; separation of customer environments; a
vulnerability and update routine; secure disposal of devices and exports; training for people with access.
For AI features: no customer personal data sent to an AI provider unless listed in section 6 and instructed; a
note of what is logged (prompts, outputs) and for how long; no use of customer data to train models unless the
controller instructs it in writing.

## 6. Sub-processors

| Sub-processor | Service | Location of processing | Safeguard for transfers outside the EEA |
| --- | --- | --- | --- |
| `[e.g. hosting provider]` | `[…]` | `[…]` | `[…]` |
| `[e.g. AI model provider, only if used for this customer]` | `[…]` | `[…]` | `[…]` |

General or specific authorisation: `[choose]`. If general, the processor gives `[notice period]` before adding or
replacing one and the controller may object on reasonable grounds. The processor imposes the same data protection
obligations on each sub-processor by contract and stays responsible to the controller for them.

## 7. Transfers outside the EEA

Only as listed in section 6, only under a valid mechanism (adequacy decision, standard contractual clauses or
another mechanism permitted by Chapter V), and with a transfer assessment where the mechanism requires one.
`[State "none" if there are none.]`

## 8. End of the services

Within `[period]` after the end, the processor returns the data in `[format]` and/or deletes it, as the controller
chooses, and confirms deletion in writing. Copies in backups are deleted on their normal cycle, at most
`[period]`. The processor keeps only what the law requires it to keep (for example accounting records of its own
invoices) and says what.

## 9. Audits

On reasonable written notice, no more than `[once a year]` unless a breach or an authority requires otherwise,
during business hours, under confidentiality, at the controller's cost unless the audit finds a material breach.
The processor may satisfy a request with up-to-date documentation or a third-party report where one exists.

## 10. Liability and order of documents

`[For the lawyer.]` If this schedule conflicts with the main agreement on the processing of personal data, this
schedule prevails.

## Internal checklist before sending

- [ ] A lawyer reviewed this template and the filled-in version.
- [ ] Section 2 lists only data the processor can really access.
- [ ] Section 5 describes measures that exist today; section 6 lists every sub-processor really used.
- [ ] The privacy policy's list of recipients matches section 6.
- [ ] The customer is told which party is controller for which data.
