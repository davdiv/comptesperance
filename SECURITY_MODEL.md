# Security model: comptesperance

Last reviewed 2026-11-25. Sections marked _(owner)_ record facts confirmed by the repository owner; the rest describes the code as it is and should be kept in sync with it.

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
| CI                  | `.github/workflows/` (`ci.yml`; `publish-image.yml`: manual dispatch, builds and pushes `ghcr.io/davdiv/comptesperance`)                                                                  |

## Entry points and who can reach them

- All routes require identity headers except `/healthz`, `/robots.txt`, `/favicon.svg` (`hooks.server.ts`).
- Read endpoints (page loads incl. `/warnings`, `GET /documents/download?path=documents/...`, `GET /projects/[id]/export.pdf`): any user in `comptes-readonly` or `comptes-readwrite`.
- CI: `publish-image.yml` runs only on manual dispatch by someone with write access to the GitHub repository; the `tag` input is validated (regex + `git check-ref-format`) and passed via `env`, never interpolated into the script.
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

## Security Invariants

Inferred from the code: how this codebase must prevent each vulnerability class.

- **Authentication (CWE-287/290)** — Every non-public route is authenticated by `handle` in `src/hooks.server.ts` via `getSessionUser` (`src/lib/server/auth.ts`), which trusts `Remote-User`/`Remote-Groups` set by Traefik's `authelia-forwardauth` middleware. Invariant: `PUBLIC_PATHS` stays limited to `/healthz`, `/robots.txt`, `/favicon.svg`; new endpoints never bypass `handle`; the app port is never published outside the Compose network (only Traefik `8080/8443` are). `AUTH_DISABLED` must never be set in production.
- **Authorization / privilege escalation (CWE-285/862)** — Every form action and every mutating `+server.ts` handler calls `requireWrite(locals.user)` first (role `comptes-readwrite` **and** `comptes_edit_mode` cookie). `/edit-mode` checks `canEdit` itself. Unsafe pattern: a new action, or a GET/`+server.ts` that writes (commits to the data repo, deletes documents) without `requireWrite`. Read-only users may read everything by design; there is no per-object ACL.
- **CSRF (CWE-352)** — SvelteKit's default origin check on form POSTs (`csrf.checkOrigin` must not be disabled) plus SameSite=Strict, HttpOnly edit-mode cookie. Invariant: no state change on GET; no `+server.ts` POST/PUT/DELETE that accepts non-form content types without its own origin check.
- **Open redirect (CWE-601)** — Redirect targets are resolved against `url.origin` and only same-origin `pathname + search` is used (`src/routes/edit-mode/+server.ts`). Invariant: every redirect built from user input follows that pattern.
- **XSS (CWE-79)** — Svelte auto-escaping; no `{@html}` in `src/`. Escape hatches: `{@html}`, `innerHTML`, serving uploaded files inline with a browser-rendered type. `documents/download` serves only the extension-mapped types (pdf/png/jpeg/webp, else `application/octet-stream`) with `content-disposition: inline`; uploads are restricted by extension in `readUploadFiles` (`src/lib/server/uploads.ts`), not by content. Invariant: never add `text/html`/`image/svg+xml` to `CONTENT_TYPES`; keep filenames sanitised (`safeDocumentName` in `repository.ts`) before use in headers.
- **Path traversal (CWE-22)** — All data-repo file access goes through `safeJoin` (`src/lib/server/store.ts`); document download additionally requires `path.posix.normalize(path) === path` and a `documents/` prefix; stored document names come from `safeDocumentName` (timestamp + UUID + slug). Entity ids used in paths (accounts, projects, third parties) go through `safeJoin` in `repository.ts`. Unsafe pattern: `path.join(repo, userValue)` without `safeJoin` (e.g. new code in `importer.ts`, which uses `path.join` on the account dir and a generated name).
- **SQL injection (CWE-89)** — SQLite cache queries (`queries.ts`, `cache.ts`) use `db.prepare` with `?` parameters; dynamic SQL is assembled only from fixed fragments (`transactionWhere` in `transaction-filters.ts` iterates a fixed key list). Invariant: user input never becomes a column name, `ORDER BY` term or SQL fragment.
- **Command / argument injection (CWE-78/88)** — git runs via `execFile('git', ['-C', root, ...args])` (`src/lib/server/git.ts`), no shell. Invariant: user-controlled values passed to git are never positioned where a leading `-` becomes an option (use `--` before paths), and commit author identity comes from `identityForUser`/`cleanName` (`commit-author.ts`).
- **File upload / resource exhaustion (CWE-400/434)** — `MAX_EVIDENCE_BYTES` per file and `BODY_SIZE_LIMIT` per request; only read-write users in edit mode can upload or import CSV. Trusted-user DoS is accepted _(owner)_.
- **Secrets (CWE-798)** — Demo secrets in `deploy/authelia/`, `docker-compose.yml`, `.env.example` are local only _(owner)_. Invariant: no production secret is committed; CI uses `github.token` only.
- **CI / supply chain (CWE-94, CWE-829)** — Workflow inputs are passed through `env` and validated before use in shell (`publish-image.yml`); actions are pinned by major tag (`actions/checkout@v4`), not SHA (gap, low). Invariant: never interpolate `${{ inputs.* }}` or event fields directly in `run:`; no `pull_request_target` with checkout of PR code.

## Out of scope / accepted risk _(owner)_

- The local-only demo secrets and demo users in `deploy/authelia/users_database.yml` (alice/bob), `deploy/authelia/configuration.yml`, `docker-compose.yml` defaults (`change-me-local-only`, sample storage key) and `.env.example`: never used in production.
- `AUTH_DISABLED=true` dev mode: local development only.

## Priorities _(owner)_

- Most important: anything letting an unauthenticated internet attacker reach data or actions, or letting a read-only user write or escalate.
- Finding tags: `Component` only (names from the Components table).

## Deployment, data access and CI _(owner)_

- Production Traefik/Authelia configuration is **kept outside this repository** (separate repo or on the server). The in-repo `deploy/` and `docker-compose.yml` are local/dev examples; findings about their concrete values (hostnames, ports, demo secrets, policy) do not describe production.
- **Every signed-in user (read-only or read-write) is meant to see all evidence documents and financial data.** Missing per-document or per-object read restrictions between signed-in users are by design, not findings.
- David is the **sole collaborator** on the GitHub repository and the only one who can dispatch `publish-image.yml`; GHCR image visibility does not matter. CI findings that need repository write access or a malicious dispatcher are out of scope.

## Open questions

- Production infra config was not available to this model; edge-auth posture in production is assumed to match the in-repo design (forward-auth on every router, app port not exposed) per the deployment facts above.
