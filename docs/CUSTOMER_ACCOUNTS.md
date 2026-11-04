# Customer accounts

Status: implemented behind `CUSTOMER_ACCOUNTS_ENABLED=false`. Not switched on anywhere. Turning it on
needs a release review (see [Before switching on](#before-switching-on)).

This is the identity layer of the SaaS expansion plan: a customer account is its own principal,
separate from staff (`admin_users`), AI operations memberships (`ops_*`) and client portal users
(`portal_*`).

## What exists

| Area | Behaviour |
| --- | --- |
| Registration | E-mail, password, optional name, language, privacy acknowledgement. Marketing consent is a separate, optional, unticked choice. No company or invoice data: the API refuses unknown fields. |
| Verification | One-time link, valid 24 h (`ACCOUNT_VERIFY_TOKEN_HOURS`). Sign-in is refused until the e-mail is confirmed. A resend replaces the earlier link. |
| Sign-in | Server-side session, cookies `acs_account_session` (HttpOnly) and `acs_account_csrf`, `SameSite=Lax`, `Secure` in production. 12 h lifetime, 2 h idle limit. |
| Recovery | One-time link, valid 1 h (`ACCOUNT_RESET_TOKEN_HOURS`). A reset closes every session of the account. |
| Sessions | List, close one, close all others, sign out. A password change closes the other sessions. |
| Profile | Name, preferred language (also used for e-mail), marketing consent with its version; consent can be withdrawn. |

Web pages: `/bg/konto` ↔ `/en/account`, with `registratsiya` ↔ `sign-up`, `vhod` ↔ `sign-in`,
`potvardi` ↔ `verify`, `nov-link` ↔ `new-link`, `zabravena-parola` ↔ `forgot-password`,
`nova-parola` ↔ `reset-password`. They are rendered per request, return 404 while the flag is off,
are `noindex`, disallowed in `robots.txt`, absent from the sitemap and not linked from the navigation.

## Isolation

Registering creates a `customer_accounts` row and nothing else. No organisation, membership, staff
role or portal user is created, and no foreign key connects these tables to staff, operations or
portal tables. An e-mail address or company domain never joins anyone to an existing organisation:
that will take an explicit invitation and a verified membership rule, which belong to the workspaces
stage and do not exist yet.

The session cookie is read only by `routers/accounts.py`. Staff sign-in, including
`ADMIN_MFA_REQUIRED`, is unchanged. The Ops runtime database role has no privilege on these tables.

## Security decisions

* **Passwords and tokens** use the existing `app/security.py`: Argon2, `generate_token`, SHA-256
  `hash_token`, constant-time comparison. No new cryptography.
* **Tokens** are stored only as hashes, with an expiry and `used_at`. Using one takes a row lock, so
  two parallel requests cannot both succeed. A token for one purpose fails for the other.
* **No raw token at rest.** The outbox row has no address, body or token. The dispatcher creates the
  token at send time; a failed attempt rolls it back and a retry creates a new one.
* **Links** are built from `SITE_URL`, never from request headers, and carry the token in the URL
  fragment (`#token=`). Fragments are not sent to servers, so tokens stay out of access logs and
  `Referer`. The page removes it from the address bar and confirms only after a button press.
* **Account enumeration.** Registration, resend and recovery return the same 202. Registering an
  existing address changes nothing and sends its owner a notice. The password is hashed on every
  registration path; sign-in verifies against a dummy hash for unknown addresses and gives one generic
  error, including for a locked account. `email_not_verified` appears only after a correct password.
* **CSRF.** Every state-changing call of a signed-in session needs the double-submit token, on top of
  the API's Origin check and `SameSite=Lax`.
* **Rate limits** are shared: `rate_limit_buckets` in PostgreSQL, one atomic upsert per hit, per IP
  and per e-mail, keyed by a keyed hash. Unlike `app/rate_limit.py` they survive restarts and hold
  across API processes.
* **Logs** carry the outbox id, kind and attempt count. Never an address, token, password or body.

## Transactional e-mail

`EMAIL_PROVIDER` selects the adapter in `app/accounts/mail.py`:

| Value | Use | Behaviour |
| --- | --- | --- |
| `disabled` | default | Registration, resend and recovery answer 503 `email_unavailable`. Anything already queued becomes `blocked`. |
| `dev_file` | development | Writes `.eml` files to `EMAIL_DEV_DIR`. Refused in production. |
| `smtp` | production | Uses `SMTP_*`. |

Production refuses to start with `CUSTOMER_ACCOUNTS_ENABLED=true` and no configured provider.

`outbox_messages.status` is the delivery status: `pending`, `sent`, `failed` (after 6 attempts, with
backoff of 1, 5, 15, 60 and 240 minutes) or `blocked`. `sent` means the provider accepted the message,
not that it reached the mailbox. A request sends straight after responding; `python -m app.cli
outbox-run` retries what is due and exits non-zero on `failed` or `blocked`. On the server that is
`infra/deploy/systemd/acs-outbox.timer`, which is not installed yet. `maintenance` removes dead
sessions and tokens, delivery records older than 30 days and stale rate-limit windows.

## Before switching on

1. A sending provider with SPF, DKIM and DMARC for the sending domain, tested end to end. The current
   `contact@ai-commercestudio.com` address only receives mail.
2. The restricted login switched on (`API_DB_USER=acs_app_api`, see `infra/deploy/README.md`) and a security review of this stage. Production refuses to start with accounts on and the owner connection.
   The same gate asks for a tested off-site restore and working alerts.
3. Privacy notice updated for account data; a new `PRIVACY_NOTICE_VERSION`.
4. `migrate-and-deploy` with a backup, then install `acs-outbox.timer`.
5. Set `EMAIL_PROVIDER`, `SMTP_*` and `CUSTOMER_ACCOUNTS_ENABLED=true`. The web container reads the
   same flag, so no rebuild is needed; add a navigation link only after that.

## Known limits

* Account deletion and data export are not built; both are needed before a real public launch.
* No customer MFA yet.
* Delivery status stops at provider acceptance: bounces need a provider webhook.
