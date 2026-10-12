# Security, privacy & compliance notes

> These are engineering controls, **not a legal opinion**. Before launch, have a UAE-qualified lawyer review the privacy notice, terms, data-processing setup and licensing under the UAE PDPL (Federal Decree-Law No. 45 of 2021), consumer-protection and e-commerce rules, and the commercial licence needed to operate the platform. The project does not claim certification or compliance.

## Implemented controls

| Control | Where |
|---|---|
| Password hashing (bcrypt, cost 12) | `api/app/security.py` |
| JWT sessions (HS256, 12 h expiry), role checks on every route | `security.py` → `require_role`, `current_supplier` |
| Supplier API keys: random 256-bit, only the SHA-256 hash stored, shown once | `/supplier/api-key` |
| Row-level security policies (defence in depth for Supabase keys) | `migrations/002_rls.sql` |
| Input validation (Pydantic schemas with length, range and pattern limits) | `api/app/schemas.py` |
| Rate limiting: global per IP + stricter limits on login, registration, inquiries, requests, AI search | `security.py`, `main.py` |
| Anti-spam on requests: honeypot field, challenge question, 3 requests per phone per hour | `request-form.tsx`, `/requests` |
| Customer contact details hidden from suppliers until a quotation is accepted | `request_out(reveal=…)` |
| Supplier documents never returned by public endpoints | `supplier_out(private=False)` |
| Upload validation: type and size checks, client-side image re-encoding, 5 MB limit on imports | dashboard + `/supplier/imports/file` |
| Security headers (nosniff, frame deny, referrer policy, HSTS in production), strict CORS allow-list | `main.py` |
| Audit log of admin and supplier actions | `audit_logs` |
| Consent capture (terms, WhatsApp, marketing), editable in the account page | registration, `/me` |
| Data export and account deletion (anonymises marketplace records) | Account → Preferences, `DELETE /me` |
| Third-party credentials (WhatsApp, Anthropic) used only server-side | `api/app/config.py` |

## Required before production
- Malware scanning of uploaded documents and images in object storage. The MVP validates type and size only.
- Move images and documents out of the database into object storage (see DEPLOYMENT.md).
- Email/phone verification (OTP) for accounts and guest requests. Use a provider such as Twilio Verify or a UAE SMS gateway.
- Distributed rate limiting if running more than one API instance.
- Secret rotation policy, centralised logging and alerting, dependency scanning (Dependabot is recommended).
- Retention jobs that apply the periods stated in the privacy notice.
- Penetration test.

## Demo mode caveat
The public GitHub Pages preview runs entirely in the browser. Its "backend" and passwords live in the visitor's `localStorage` and provide **no security**. That's acceptable because it only holds fictional sample data.
