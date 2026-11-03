# Client portal (read-only) — off by default

Status: implemented on 2026-11-03 and **switched off** (`CLIENT_PORTAL_ENABLED=false`). It must not
be released publicly without explicit approval. While it is off, every portal route answers 404 and
`/portal` says the portal is not open.

## Prerequisites check (done before building it)

The task required the portal to be built only if the isolation foundation holds. It was verified on
this branch:

* **Restricted-role RLS tests pass.** `tests/test_ops_security.py` runs as `acs_app_runtime`, which is
  NOLOGIN, NOBYPASSRLS and owns no tables. The test of the owner shows that owner-only tests would
  prove nothing.
* **Tenant-isolation tests pass.** These are the route-level tests in `test_ops_*.py` and
  `test_portal.py`.
* **The authorization design is complete.** Separate identities and permissions, the tenant taken from
  the session, read-only routes.

No blocker was found.

## Design

| Concern | Implementation |
| --- | --- |
| Identities | `portal_users`, separate from staff `admin_users`, with its own sessions (`portal_sessions`) and cookies (`acs_portal_session` httpOnly, `acs_portal_csrf`), both SameSite=Strict. A staff password never opens the portal, and a portal session never opens the admin or Ops API. |
| Organisation | Each client user belongs to exactly one organisation. It comes from the authenticated session; **no client route takes an organisation id**, and the session binds the request under RLS. |
| Invitation | Staff with `portal_users.write` invite by e-mail. The one-time token (SHA-256 stored, 72 h by default) is in a URL fragment (`/portal/activate#…`), so it never reaches access logs; the page removes it from the address bar. There are no invitations for demo organisations. |
| Activation | The client sets a password (≥ 12 characters, mixed case and digits) and enrols TOTP (RFC 6238, SHA-1, 30 s, 6 digits). The first valid code activates the account and consumes the token. |
| MFA (enforced) | Login is password, then a TOTP code; a session is usable only after the code. Codes are accepted with ±1 step of drift, and a used step is refused (no replay). The TOTP secret is **derived** from `SECRET_KEY` and a random per-user nonce. It is never stored, so a database copy alone cannot generate codes. |
| Sessions | 8 h absolute lifetime and a 30 min idle timeout (configurable). Logout, disabling the user and suspending the organisation revoke sessions. CSRF is checked on every state-changing request. |
| Brute force | IP rate limit and a lockout after 5 failures (15 min). Every failure gets the same 401 `portal_invalid_login`, so accounts cannot be enumerated. |
| Recovery | Staff-assisted. A one-time recovery link resets the password **and** the second factor (new nonce) and revokes existing sessions. There is no self-service e-mail reset until e-mail delivery is configured and approved. |
| Read-only | The client router has only GET data routes plus the authentication POSTs. Any other method answers 405. |
| Data shown | Agents (name, status, environment, approved version number — no prompts, tools or providers); evaluation summaries (dataset, versions, passed/total, `simulated`); incidents (number, title, severity, impact, status, dates, the client summary, and a status history without internal notes); and an explicit "not connected" monitoring note. There is no billing or payment collection and no write access. |
| Audit | Logins, failed logins, failed codes, enrolments and every data view (`ops.portal_viewed` with the resource) are recorded with the organisation and appear in the organisation's audit view for staff. |

## Before a public release (not done)

* An external penetration test of authentication and isolation.
* A deployment with a **separate runtime login role**: today the application connects as the schema
  owner and switches to `acs_app_runtime` per transaction (see [AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md)).
* Transactional e-mail for invitations and self-service recovery, with approval of the wording.
* A data processing agreement and the privacy notice for client users.
* Explicit approval, then `CLIENT_PORTAL_ENABLED=true`.

## Tests

`apps/api/tests/test_portal.py` covers:

* the feature gate;
* RFC 6238 vectors and replay;
* invitation, activation and the second factor;
* single-use tokens;
* staff and client separation;
* weak passwords and no enumeration;
* lockout;
* idle expiry and logout;
* CSRF;
* recovery that resets MFA and revokes sessions;
* the read-only dashboard and 405 for writes;
* no prompt content and no internal notes;
* the tenant taken from the session (client B cannot see A even with a query parameter);
* suspended organisations and disabled users;
* demo organisations;
* staff permissions;
* the audit.

The web tests are `components/portal/portal.test.tsx` (unavailable state, two-step sign-in, CSRF
header, no organisation id in any request, BG/EN parity).

### End-to-end test

* `ops-platform.spec.ts` (every run, portal off): the page says the portal is not open and the API
  answers 404.
* `portal.spec.ts` (only with the portal on) walks the whole flow in a browser:
  1. a staff invitation (refused for a demo organisation);
  2. activation from the link (the token leaves the address bar);
  3. password and TOTP enrolment;
  4. sign-in with a fresh code (the enrolment step cannot be replayed);
  5. the dashboard with the "not connected" note;
  6. isolation: a query parameter never selects another tenant, writes answer 405, and the admin and
     Ops APIs answer 401 to the client session;
  7. sign-out revokes the session.

  It skips itself in the default e2e suite (portal off). It runs in its own suite and CI job
  (`e2e-portal`), which:
  * switch the portal on in a throwaway **test stack** (`docker-compose.portal-e2e.yml`);
  * create the non-demo organisation `e2e-portal`;
  * fail instead of skipping (`E2E_REQUIRE_PORTAL=1`);
  * switch the stack back to the default afterwards.

  ```powershell
  .\scripts\test.ps1 -Suite portal
  ```

  Switching the portal on in a test stack is not a release: the repository default stays off.
