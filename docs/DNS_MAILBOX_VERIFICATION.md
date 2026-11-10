# DNS and mailbox verification

**Status: NOT VERIFIED — EXTERNAL DNS AND MAILBOX CHECK REQUIRED.** What follows is evidence of what name servers
answered at one moment from one machine, and an owner checklist. It is not proof that mail does or does not arrive.
No mail was sent, no DNS record was changed, no credential was used.

## 1. Two different domains

| Name | Where it appears | What it is |
| --- | --- | --- |
| `ai-commercestudio.com` | `SITE_URL` in `infra/deploy/production.env.example`; the live website | The website hostname (the live pages answered over HTTPS on 2026-11-10) |
| `ai-ecomstudio.site` | The built-in default of `company.ts` (`APPROVED.domain`), i.e. `contact@ai-ecomstudio.site` when a build has no override | The "planned" contact domain recorded in CLAUDE.md |

`company.ts` documents that production builds set `PUBLIC_CONTACT_DOMAIN` and `PUBLIC_CONTACT_EMAIL` from repository
variables, and the **live site shows `contact@ai-commercestudio.com`** (observed below). So the default `.site`
address is what a build WITHOUT those variables would publish; it is not what the live site publishes today.
The earlier statement that "the published contact address cannot receive mail" was too broad: it was based on the
`.site` default only. The protected contact values in `company.ts` were not changed.

## 2. What was observed (2026-11-10, from the developer's machine; local resolver 192.168.0.1 and public resolvers)

Commands: `nslookup -type=<TYPE> <name> [resolver]` and DNS-over-HTTPS JSON queries
(`https://cloudflare-dns.com/dns-query?name=…&type=…`, `https://dns.google/resolve?name=…&type=…`).

| Name | Query | Resolver | Time (UTC) | Result |
| --- | --- | --- | --- | --- |
| `ai-ecomstudio.site` | A, AAAA, MX, NS, TXT, SOA | system default, 1.1.1.1, 8.8.8.8, 9.9.9.9 | 18:27:25 | **Non-existent domain** (NXDOMAIN) for all 24 queries |
| `ai-ecomstudio.site` | MX (DoH) | Cloudflare | 18:27 | `Status: 3` (NXDOMAIN); authority = SOA of the `site.` zone (`ns.trs-dns.com`) |
| `ai-ecomstudio.site` | NS (DoH) | Google | 18:27 | `Status: 3` (NXDOMAIN); authority = SOA of the `site.` zone |
| `www.ai-ecomstudio.site`, `mail.ai-ecomstudio.site` | A | 1.1.1.1 | 18:27 | Non-existent domain |
| `ai-commercestudio.com` | MX | 1.1.1.1 and Cloudflare DoH | 18:27:48 | `Status: 0`: `route1.mx.cloudflare.net` (4), `route2.mx.cloudflare.net` (2), `route3.mx.cloudflare.net` (21) |
| `ai-commercestudio.com` | NS | 1.1.1.1 | 18:27:48 | `gloria.ns.cloudflare.com`, `jermaine.ns.cloudflare.com` |
| `ai-commercestudio.com` | TXT (DoH) | Cloudflare | 18:28 | `google-site-verification=…` and `v=spf1 include:_spf.mx.cloudflare.net ~all` |
| `_dmarc.ai-commercestudio.com` | TXT (DoH) | Cloudflare | 18:28 | `Status: 3` (no DMARC record) |
| `ai-commercestudio.com` | HTTPS GET `/bg`, `/en`, `/bg/kontakti`, … | direct | 18:28:01 | 200, `Server: cloudflare`; the page shows `contact@ai-commercestudio.com` |

A and AAAA for `ai-commercestudio.com` were queried by `nslookup` but the output of this run did not capture the
addresses (the site is proxied by Cloudflare); the site answered over HTTPS, so name resolution worked.

### What this does and does not show

* `ai-ecomstudio.site` does not exist in DNS at this moment, from four resolvers and two DoH endpoints. A mail
  server cannot deliver to a domain that does not resolve; a build that publishes that default address publishes an
  address that cannot work **until the domain is registered and its mail is set up**. It may have been registered very
  recently (negative answers are cached, TTL about 300 s), so repeat the check before concluding anything.
* `ai-commercestudio.com` has Cloudflare Email Routing MX records. Email Routing **forwards** to a destination
  mailbox; whether the `contact@` rule exists, whether the destination is verified, and whether a message arrives
  is **not observable from DNS**.
* SPF exists and covers Cloudflare Email Routing for inbound mail only; **no DMARC record** exists, and no DKIM
  selector was tested (selector names are provider-specific). Transactional e-mail from the application (SMTP, when
  enabled) needs its own sender domain, SPF include, DKIM and DMARC; none of that is verified.

## 3. Owner checklist (a checklist is not proof)

Do each item from outside the developer's network and write down the date and result.

- [ ] Decide which domain publishes the contact address in every build (the repository variables `PUBLIC_CONTACT_DOMAIN` / `PUBLIC_CONTACT_EMAIL`) and whether `ai-ecomstudio.site` is still the plan.
- [ ] **DNS resolution:** `nslookup <domain>` from two other networks returns addresses (website host).
- [ ] **MX resolution:** `nslookup -type=MX <contact domain>` returns the intended mail servers.
- [ ] **Mailbox existence:** the `contact@` address exists (a real mailbox, or a routing rule with a verified destination).
- [ ] **SPF:** one SPF record that covers every sender (inbound routing and the outbound SMTP provider).
- [ ] **DKIM:** the outbound provider's DKIM record is published and verified in its dashboard.
- [ ] **DMARC:** a `_dmarc` record exists (start with `p=none` and reports), then tighten.
- [ ] **Transactional sender domain:** `SMTP_FROM` uses a domain whose SPF/DKIM/DMARC pass; the privacy requests and withdrawal acknowledgements come from it.
- [ ] **Reply-to behaviour:** a reply to a transactional message reaches a monitored mailbox, or the message says it is not monitored.
- [ ] **Test delivery:** send one message from an external account to the contact address and confirm it is received; send a test transactional message (staging SMTP) and confirm receipt and headers.
- [ ] **Bounce handling:** send to a non-existent address and confirm the bounce/failed state is visible (outbox `failed` / provider dashboard).
- [ ] **Address list:** decide which verified mailbox is used for public contact, privacy requests, withdrawal confirmations, billing communication and transactional mail. Do not use an address that has not passed the test above.

Until every item is ticked with a date, the status stays NOT VERIFIED. It is a **release blocker for accounts and
payments** (the withdrawal acknowledgement and privacy requests depend on working mail) and for any build that publishes
a contact address.

## 4. Hard go-live blocker (2026-11-11)

E-mail delivery is a **hard go-live blocker** for customer accounts and payments. MX records only say where mail for a
domain should go; they do **not** prove that a mailbox exists, that a message arrives, or that the application's own
messages are delivered. A production start with `CUSTOMER_ACCOUNTS_ENABLED=true` or any `BILLING_PROVIDER` is refused
until the owner sets `EMAIL_DELIVERY_VERIFIED=true` (app/config.py), and that setting is an attestation: set it only
after every row below has a date and a result. No production mail setting was changed and no test mail was sent.

| # | Check | How | Result / date |
| --- | --- | --- | --- |
| 1 | Mailbox exists | The `contact@` mailbox (or routing rule with a verified destination) exists in the provider's console | NOT VERIFIED |
| 2 | Inbound delivery | Send from two external providers (e.g. one consumer, one business mailbox) to the published address; both arrive | NOT VERIFIED |
| 3 | Outbound transactional delivery | From staging, trigger a verification e-mail and a withdrawal acknowledgement; both arrive in an external inbox, not in spam | NOT VERIFIED |
| 4 | SPF | One SPF record covering inbound routing and the outbound SMTP provider; `spf=pass` in received headers | NOT VERIFIED (inbound-only SPF seen on `ai-commercestudio.com`) |
| 5 | DKIM | The provider's DKIM selector is published; `dkim=pass` in received headers | NOT VERIFIED |
| 6 | DMARC | `_dmarc` record published; `dmarc=pass` in received headers | NOT VERIFIED (no record on `ai-commercestudio.com`) |
| 7 | Reply-to | A reply to a transactional message reaches a monitored mailbox, or the message says replies are not read | NOT VERIFIED |
| 8 | Bounce handling | A message to a non-existent address ends as `failed` in the outbox (and in the provider's log) without blocking other messages | NOT VERIFIED (code path tested; real provider not) |
| 9 | Retries | With SMTP unreachable, the outbox keeps the message `pending` and retries with backoff; it is sent once SMTP is back | Tested in code (`test_a_failed_confirmation_e_mail_does_not_lose_the_request`); real provider NOT VERIFIED |
| 10 | Duplicate protection | One acknowledgement per withdrawal reference (unique index `uq_outbox_messages_kind_reference`); a repeated statement does not send a second one | Tested in code; real provider NOT VERIFIED |
| 11 | BG and EN templates | The withdrawal acknowledgement, verification and reset messages read correctly in both languages, with the reference, submission time, purchase and statement | Rendered in tests; a person reading the real messages: NOT VERIFIED |
