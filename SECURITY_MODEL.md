# Security model: comptesperance

Last reviewed 2026-11-11. Sections marked _(owner)_ record facts confirmed by the repository owner; the rest describes the code as it is and should be kept in sync with it.

## System overview and trust boundaries

Comptesperance is a bilingual (FR/EN) SvelteKit 5 accounting app (adapter-node) for a small organisation. The source of truth is a local **git data repository** (`DATA_REPO_PATH`, `/data` in Compose) holding JSON config, accounts, transactions, annotations, projects, third parties, imported bank CSV statements and uploaded evidence documents. A **SQLite cache** (`CACHE_DB_PATH`) is disposable and rebuilt from the repo.

Deployment (`docker-compose.yml`, `deploy/`): Traefik v3 terminates TLS and applies an Authelia `forwardAuth` middleware (`/api/authz/forward-auth`, `trustForwardHeader: true`) that forwards `Remote-User`, `Remote-Groups`, `Remote-Name`, `Remote-Email` to the app. Authelia uses a file user backend, one-factor policy, `default_policy: deny`.

Trust boundaries:

1. Browser -> Traefik/Authelia (internet or network edge).
2. Traefik -> app container on port 3000: the app **trusts identity headers unconditionally** (`src/lib/server/auth.ts` `getSessionUser`). Anything that can reach port 3000 directly can impersonate any user/group.
3. Read-only role -> read-write role (`requireWrite` + edit-mode cookie).
4. App -> filesystem / git subprocess (`src/lib/server/git.ts`, `store.ts` `safeJoin`).

## Components

| Name                | Covers                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge Auth           | `deploy/traefik/`, `deploy/authelia/`, `docker-compose.yml`, `Dockerfile`, `.env.example`                                                                                                 |
| App Auth            | `src/hooks.server.ts`, `src/lib/server/auth.ts`, `src/routes/edit-mode/`, `src/routes/+layout.server.ts`                                                                                  |
| Web UI              | `src/routes/**/*.svelte`, `src/lib/components/`, `src/lib/format.ts`, `src/lib/labels.ts`, `messages/`                                                                                    |
| Server Actions      | `src/routes/**/+page.server.ts` (form actions and loads), `src/lib/server/allocation-editor.ts`, `annotations.ts`, `transfer-*.ts`, `transaction-*.ts`, `payment-modes.ts`, `balances.ts` |
| Documents & Uploads | `src/routes/documents/`, `src/lib/server/uploads.ts`, `src/lib/documents.ts`                                                                                                              |
| CSV Import          | `src/routes/import/`, `src/lib/server/importer.ts`, `src/lib/server/csv/`                                                                                                                 |
| Data Store          | `src/lib/server/repository.ts`, `store.ts`, `git.ts`, `cache.ts`, `queries.ts`, `config.ts`, `env.ts`                                                                                     |
| CI                  | `.github/workflows/`                                                                                                                                                                      |

## Entry points and who can reach them

- All routes require identity headers except `/healthz`, `/robots.txt`, `/favicon.svg` (`hooks.server.ts`).
- Read endpoints (page loads, `GET /documents/download?path=documents/...`): any user in `comptes-readonly` or `comptes-readwrite`.
- Form actions (create/edit accounts, transactions, allocations, projects, third parties, settings, transfers, CSV import, document upload/delete): `comptes-readwrite` **and** edit-mode cookie (`requireWrite`).
- `POST /edit-mode`: read-write users; sets HttpOnly SameSite=Strict cookie; `return_to` restricted to same origin.
- File inputs: evidence uploads (pdf/png/jpg/webp by extension, `MAX_EVIDENCE_BYTES` 25 MiB each, `BODY_SIZE_LIMIT` 100M) and bank CSV statements (CCP, SumUp parsers).

## Assets and data sensitivity

- Financial records of the organisation (transactions, balances, third-party names) — confidential, integrity-critical.
- Evidence documents (invoices, receipts; may contain personal data) — confidential.
- Git history of the data repo — integrity / audit trail.
- Authelia session secrets, JWT secret, storage key, user password hashes — critical for edge auth.
- Host filesystem / container (via path traversal or git argument injection).

## Deployment facts _(owner)_

- Production is **internet-facing** behind Traefik + Authelia, as in `docker-compose.yml`.
- **Only Traefik can reach the app container's port 3000.** Direct access to the app (and thus spoofing `Remote-User`/`Remote-Groups` by bypassing Traefik) is not an available path in production.

## Attacker profiles

Attackers that matter _(owner)_:

- **Unauthenticated internet attackers** reaching Traefik/Authelia. (Inferred: this includes cross-site attackers targeting signed-in users' browsers — CSRF, open redirects, XSS delivered from outside.)
- **Read-only users** (`comptes-readonly`) trying to modify data or escalate to write access.

Not selected as attackers that matter _(owner)_:

- **Read-write users** (`comptes-readwrite`) are trusted: issues that require a read-write user acting maliciously (malicious uploads, crafted CSV imports, stored payloads they enter themselves, self-DoS) are low priority, unless an outsider or read-only user can trigger them.
- An attacker with direct network access to the app port (ruled out by the deployment fact above).

## Existing controls

- Authelia forward-auth, default deny, one-factor; app returns 401/403 rather than redirecting.
- Role check + explicit edit mode for writes (`requireWrite`).
- SvelteKit built-in CSRF origin check; edit-mode cookie SameSite=Strict, HttpOnly.
- Document download path normalisation + `documents/` prefix + `safeJoin`.
- git invoked via `execFile` with argument arrays (no shell).
- Upload size and extension limits.
- Svelte auto-escaping (no `{@html}` found in `src/`).

## Out of scope / accepted risk _(owner)_

- The local-only demo secrets and demo users in `deploy/authelia/users_database.yml` (alice/bob), `deploy/authelia/configuration.yml`, `docker-compose.yml` defaults (`change-me-local-only`, sample storage key) and `.env.example`: never used in production.
- `AUTH_DISABLED=true` dev mode: local development only.

## Priorities _(owner)_

- Most important: anything letting an unauthenticated internet attacker reach data or actions, or letting a read-only user write or escalate.
- Finding tags: `Component` only (names from the Components table).

## Open questions

- Is the production infrastructure configuration (real Authelia/Traefik config, domains, secrets management) kept in this repository or elsewhere? This model uses the in-repo `deploy/` and Compose files; no separate infrastructure repository was used.
- Is evidence confidentiality between read-only users a concern (all signed-in users currently see all documents)?
