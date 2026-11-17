# comptesperance

Bilingual (English/French) accounting app backed by a local git data repository, with a disposable SQLite cache. It tracks accounts, transactions, projects, third parties, evidence documents, CSV bank imports, internal transfers, balance checkpoints and warnings.

## Quick start

### Try the published image locally

The `Publish container image` workflow pushes `ghcr.io/davdiv/comptesperance:<tag>` (default `latest`). If GHCR requires authentication for your account, log in first with `podman login ghcr.io` (or `docker login ghcr.io`).

For a quick local evaluation without building from source, run the image with auth disabled and persistent volumes:

```bash
podman run -d --name comptes -p 3000:3000 \
  -e AUTH_DISABLED=true \
  -e ORIGIN=http://localhost:3000 \
  -v comptes-data:/data \
  -v comptes-cache:/cache \
  ghcr.io/davdiv/comptesperance:latest
```

Open http://localhost:3000. `ORIGIN` must match that public URL so form POSTs such as edit mode are accepted over plain HTTP. `AUTH_DISABLED=true` is only for local evaluation; use the authenticated Compose stack below for anything shared or production. The app stores its git data repository in `/data` and the SQLite cache in `/cache`. Stop and remove the container with `podman stop comptes && podman rm comptes`; remove the named volumes too if you want to delete the data. Docker accepts the same `run` arguments if you prefer `docker` over `podman`.

### Run the full local demo stack

```bash
docker compose up --build
```

No host Node.js setup is needed; Compose builds the app image.

Open:

- App: https://comptes.localhost:8443
- Authelia portal: https://auth.comptes.localhost:8443

The checked-in Authelia setup uses HTTPS and a session cookie domain covering the portal and app hosts, so local testing uses `comptes.localhost` with Traefik TLS on port 8443. The first certificate is self-signed; accept the browser warning, sign in at the Authelia portal, then open the app.

Ready-to-use local users:

- `alice` / `alice` — `comptes-readwrite`
- `bob` / `bob` — `comptes-readonly`

The checked-in Compose file is a local demo: it uses the demo users and `change-me-local-only` secrets, binds ports 8080/8443, and serves self-signed TLS. Do not expose it as production.

## Production deployment

The production shape is Traefik (TLS + forward auth) -> Authelia -> app. Only Traefik may reach the app container's port 3000: the app trusts `Remote-User`/`Remote-Groups`/`Remote-Name`/`Remote-Email` headers unconditionally, so direct access to the app port would allow impersonation. The Compose file does not publish port 3000; keep it that way.

### 1. Configure domains and TLS

- Edit `deploy/traefik/dynamic.yml`: change the `HostRegexp` rules for `comptes-app` and `authelia-portal` to your app and auth hostnames. The services already point to `http://app:3000` and `http://authelia:9091`.
- The checked-in TLS configuration is for local `*.localhost` testing. For production, terminate TLS with your own certificates or configure Traefik's certificate provider, and publish ports 80/443 (or keep the stack behind an existing reverse proxy).
- Edit `deploy/authelia/configuration.yml`: set the session cookie `domain` to a parent domain covering both the portal and app hosts (the checked-in `comptes.localhost` covers `auth.comptes.localhost` and `comptes.localhost`), set `authelia_url` and `default_redirection_url` to your exact portal/app URLs, and update `access_control` so the portal domain bypasses and the app domain uses `one_factor`.

### 2. Create users and groups

Replace `deploy/authelia/users_database.yml`; the checked-in `alice`/`bob` users are local fixtures only. The file backend uses bcrypt password hashes and Authelia groups. Use `comptes-readwrite` for users who may edit and `comptes-readonly` for view-only users; the Compose service already maps those group names to the app.

Read-only users can view data. Read-write users still start in read-only display and must use **Switch to edit mode** before writes; the toggle stores an HttpOnly, SameSite=Strict cookie and the server rejects writes unless both the write role and edit mode are present.

### 3. Set secrets and app settings

```bash
cp .env.example .env
# .env is gitignored; never commit it.
```

Compose reads `.env` for the values it interpolates: the Authelia secrets and `AUTH_LOGOUT_URL`, `AUTH_PROFILE_URL`, `BODY_SIZE_LIMIT` and `MAX_EVIDENCE_BYTES`. Generate a fresh random value with `openssl rand -hex 32` for each Authelia secret (run it separately for each one).

Set in `.env`:

- `AUTHELIA_SESSION_SECRET`
- `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET`
- `AUTHELIA_STORAGE_ENCRYPTION_KEY` (64 hex characters)
- `AUTH_LOGOUT_URL=https://auth.example.com/logout`
- `AUTH_PROFILE_URL=https://auth.example.com/settings/security`
- optionally `BODY_SIZE_LIMIT` / `MAX_EVIDENCE_BYTES`

Auth stays enabled: the Compose `app` service sets `AUTH_DISABLED=false`; do not use `AUTH_DISABLED=true` outside local evaluation. The Compose service also sets `AUTH_READWRITE_GROUP=comptes-readwrite` and `AUTH_READONLY_GROUP=comptes-readonly`; if you change those, update the Compose `environment` and the Authelia groups together. `TZ` is an image default (`Europe/Paris`); to override it in Compose, add `TZ` under the `app` service's `environment`.

### 4. Choose the app image and start

From a source checkout, the Compose file builds the Dockerfile:

```bash
docker compose up -d --build --wait --wait-timeout 120
```

To use the published image instead, change the `app` service in your deployment copy from `build: .` to `image: ghcr.io/davdiv/comptesperance:<tag>`, then authenticate to GHCR if required. The published image contains only the app; Traefik and Authelia still come from their registry images.

Check status and logs:

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f authelia
docker compose logs -f traefik
```

The app image has a Docker healthcheck; Traefik also has a ping healthcheck. Use `docker compose ps` health status and the logs above for day-to-day operations. If the app returns 401/403, check Authelia groups and edit mode before changing app configuration.

## Configuration reference

| Variable                                                 | Default                                                           | Purpose                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DATA_REPO_PATH`                                         | `/data` in image, `./data` in dev                                 | Git data repository (source of truth).                                       |
| `CACHE_DB_PATH`                                          | `/cache/comptes.sqlite` in image, `./.data/comptes.sqlite` in dev | Disposable SQLite cache.                                                     |
| `AUTH_DISABLED`                                          | unset/false                                                       | Local-only writer mode; never enable in production.                          |
| `AUTH_LOGOUT_URL`                                        | Compose local Authelia logout                                     | Sign-out endpoint; the app appends `rd=<app origin>`.                        |
| `AUTH_PROFILE_URL`                                       | Compose local Authelia settings                                   | Optional **Profile & security** link target.                                 |
| `AUTH_READWRITE_GROUP`                                   | `comptes-readwrite`                                               | Authelia group allowed to write.                                             |
| `AUTH_READONLY_GROUP`                                    | `comptes-readonly`                                                | Authelia group allowed to read.                                              |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL`                   | `comptes app` / `comptes@app.local`                               | Legacy-named settings that control the git committer outside request scope.  |
| `MAX_EVIDENCE_BYTES`                                     | `26214400` (25 MiB)                                               | Per-file evidence/document limit.                                            |
| `BODY_SIZE_LIMIT`                                        | `100M` in Compose/image                                           | adapter-node total request-body limit.                                       |
| `TZ`                                                     | `Europe/Paris` in image                                           | Time zone for local times and PDF timestamps.                                |
| `AUTHELIA_SESSION_SECRET`                                | local demo value                                                  | Authelia session secret; set a random value in production.                   |
| `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET` | local demo value                                                  | Authelia reset-password token secret; set a random value in production.      |
| `AUTHELIA_STORAGE_ENCRYPTION_KEY`                        | local demo value                                                  | Authelia storage encryption key; set 64 random hex characters in production. |

Compose only passes variables it references. Set app-only variables such as `TZ` or `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL` under the `app` service's `environment` in your deployment copy.

## Data, backups and upgrades

The git data repository at `DATA_REPO_PATH` is the source of truth; the SQLite cache is disposable and rebuilt from those files. Documents/evidence live under `/data/documents`, and Git's repository lives under `/data/.git`. In Compose these are the `comptes-data` and `comptes-cache` volumes; Authelia keeps its own `authelia-data` volume.

Back up `comptes-data` and `authelia-data`. `comptes-cache` can be recreated. With the default Compose project name (`comptesperance`):

```bash
docker compose down
mkdir -p backups
docker run --rm \
  -v comptesperance_comptes-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine tar -czf "/backup/comptes-data-$(date +%F).tgz" -C /data .
docker run --rm \
  -v comptesperance_authelia-data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine tar -czf "/backup/authelia-data-$(date +%F).tgz" -C /data .
```

Check `docker volume ls` if your Compose project name differs. Restore by recreating the volumes and extracting the tarballs with the same UID/GID 1000 ownership described below.

The app image runs as `node` (UID/GID 1000:1000), not root. Its defaults are `DATA_REPO_PATH=/data` and `CACHE_DB_PATH=/cache/comptes.sqlite`; the image owns both directories so fresh named volumes get the correct ownership. Bind mounts must likewise be writable by UID 1000. Do not run the app as root or make volumes world-writable.

There is no automatic migration or legacy-format compatibility layer for older data formats. Back up before upgrading; if an upgrade changes the data format, restore from a pre-upgrade backup.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` if you want to change `DATA_REPO_PATH`, `CACHE_DB_PATH`, or disable auth locally. Local development uses the host time zone unless `TZ` is set in the shell (for example `TZ=Europe/Paris npm run dev`); `.env` does not set it for the Node process.

## Tests and checks

```bash
npm run check
npm run lint
npm run test:unit -- --run
npm run build
```

The E2E suite uses the real Traefik + Authelia + app stack, including the committed local fixture users above. Never point it at production: it creates accounts, transactions, projects, documents and repeated CSV imports. A fresh Compose project gives each run isolated data, cache and Authelia volumes. Only one stack can bind ports 8080/8443 at a time; stop any existing stack first without deleting its volumes.

```bash
npm ci
npx playwright install --with-deps chromium # or set PLAYWRIGHT_CHANNEL=chrome to use installed Google Chrome
export COMPOSE_PROJECT_NAME="comptes-e2e-$(date +%s)"
docker compose up -d --build --wait --wait-timeout 120
docker compose exec app id # uid=1000(node)
PLAYWRIGHT_BASE_URL=https://comptes.localhost:8443 npm run test:e2e
docker compose down --volumes # deletes only this disposable project's data
```

Playwright ignores the local self-signed certificate. Chromium resolves `*.localhost` to loopback; if Node/curl on your machine does not, add `127.0.0.1 comptes.localhost auth.comptes.localhost` to `/etc/hosts`. `PLAYWRIGHT_BASE_URL` defaults to the Compose app URL; Authelia/Traefik host rules must still match the URL you use.

Tests cover signed-out redirects and return URLs, read-only permission checks, writer edit-mode switching, account/manual transaction/project allocation writes, a 2 MiB evidence upload and download, CCP/SumUp imports and stable rows/IDs on reimport, and sign-out. No preview server or auth bypass is used. `playwright-report/` contains the HTML report; failed tests retain screenshots and traces under `test-results/`.

CI builds a fresh project per run, waits for service health, checks the non-root UID and runs this suite with the runner's preinstalled Google Chrome (`PLAYWRIGHT_CHANNEL=chrome`), so it downloads no browser or system packages. On failure it uploads the Playwright report, traces/screenshots and Compose logs, then always tears down the test volumes.

## Upload limits

`MAX_EVIDENCE_BYTES` limits each document/evidence file (default 26214400 bytes, 25 MiB). `BODY_SIZE_LIMIT` is adapter-node's total HTTP request-body limit, including all files and multipart overhead. Docker and Compose default to `100M` (100 MiB); both settings can be overridden through environment variables. Keep the total limit above the per-file limit, allowing headroom for multi-file batches. Split large batches across requests; four maximum-size files plus multipart overhead will exceed 100 MiB.

When running `node build` directly, explicitly set `BODY_SIZE_LIMIT=100M`: adapter-node otherwise defaults to 512 KiB, well below the app's per-file limit. For local HTTP production testing also set `ORIGIN=http://localhost:<port>`. Traefik's supplied configuration has no buffering/body-limit middleware. Other upstream proxies may impose their own limits and must be configured separately. Per-file and request-body rejections are shown as bilingual upload errors.

## Data repository format

`/projects/unallocated` is a computed view, not a stored project. It lists non-excluded transactions with a non-zero unallocated remainder (transaction amount minus allocations). Incoming/outgoing/net totals always include internal transfers; the internal transfer toggle only hides rows. Per-account breakdowns omit net-zero accounts. In edit mode, Allocate links open the existing transaction allocation editor.

The git data repository is the source of truth; SQLite is disposable and rebuilt from these files. All monetary amounts are integer cents in EUR. No migration or legacy-format compatibility is provided.

- `config/app.json`: `{ "name": "Comptesperance" }`.
- `config/categories.json`: `[{ "id": "dons", "name": "Dons", "kind": "income", "archived": false }]`; kind is `income` or `expense`.
- `config/payment-modes.json`: `[{ "id": "carte", "name": "Carte bancaire", "archived": false }]`. Missing config files are initialized with French defaults and committed. Settings edits each make one data-repository commit. Used entries can be archived but not deleted.
- `accounts/<id>/account.json`: `{ "account": { "id": "...", "name": "...", "source": "manual", "notes": "...", "created_at": "...", "updated_at": "..." }, "transactions": [] }`. CSV accounts omit `transactions` and keep unchanged CSV imports in `statements/`. Accounts have no type, currency or opening-balance field. Optional top-level `checkpoints` in `account.json` store manual end-of-day balances: `[{ "id": "...", "date": "2026-10-02", "balance_cents": 20000, "note": "Cash count" }]`. They are available for both manual and CSV accounts. Statement checkpoints are derived only in SQLite from every CCP header date and balance; SumUp has none. In edit mode, CSV checkpoints can be ignored or restored on the account page; ignored rows stay visible but never anchor balances or produce reconciliation warnings. `ignored_statement_checkpoints` in `account.json` stores SHA-256 fingerprints of ignored CSV contents. Re-importing identical contents, even under another filename, preserves the decision; restoring any identical copy restores all of them. Each ignore/restore mutation makes one data commit. Manual checkpoints remain deletable. Current balance uses the latest checkpoint (statement preferred on date ties) plus non-excluded transactions on later calendar days. Without a checkpoint, balance starts at zero. Every earlier checkpoint is reconciled against the latest anchor; differences are recorded minus computed balances. Same-source/date ties use checkpoint ID order for a stable anchor, retaining all checkpoints for comparison. Optional initial balance/date on account creation creates one manual checkpoint in the same data-repository commit.
- Manual transactions have `id`, `date`, `amount_cents`, `label` and optional `description`, `notes`, `third_party_id`, `category_id`, `payment_mode_id`, `excluded`, `evidence`, a shared `transfer_id` and timestamps.
- `accounts/<id>/annotations.json` for CSV accounts maps transaction IDs to annotation objects: optional notes, category/payment-mode/third-party IDs, evidence, a shared `transfer_id`, excluded and allocations. Internal transfers group two or more transactions across at least two accounts. Groups may be unbalanced; amount and per-project allocation imbalances are warnings. Removing a member dissolves groups with fewer than two members or accounts. CSV parsed value dates and statuses are retained for display. Cancelled SumUp transactions default to excluded; an explicit annotation overrides that default.
- Allocations belong to each manual transaction or CSV annotation: `"allocations": [{ "project_id": "kermesse", "amount_cents": 1250, "note": "Part" }]`. A project appears at most once per transaction; amounts have the transaction's sign and their absolute sum cannot exceed its absolute amount.
- `projects/<id>.json` contains only `id`, `name`, optional `description`, `created_at`, `updated_at`. Hiding internal transfers only filters displayed rows: totals and summary counts always include internal transfer members, including project allocations. Orphan allocations are ignored. Deleting a project removes its allocations from all manual transactions and CSV annotations in the same commit.
- SumUp CSV formats are unchanged. Accepted sales use gross amounts; a derived fee transaction has id `<sale fingerprint>:fee` and a negative amount. Fees support the same annotations and exclusions as any CSV transaction. Settlements use the net payout on the payout date. Sale descriptions and detail links join the sale, fee and settlement across the account's statement set.
- `/transfers` suggests complete balanced internal transfer payout-ID groups (SumUp settlements plus the CCP credit), followed by exact opposite-amount pairs within seven days. Suggestions exclude linked/excluded transactions and do not overlap; bulk linking writes all groups in one data-repository commit. Amount and project-allocation imbalances on manually assembled groups remain visible warnings.
- `third-parties/<id>.json` and `documents/` retain their existing formats. Evidence paths can be shared by multiple transactions.

## Browsing transactions and internal transfers

Transaction lists use 50 rows per page by default, with 25/50/100-row choices. Filters and pagination are reflected in the URL. Financial summaries cover all matching transactions, independently of the page and internal-transfer visibility; project PDF exports include all matching rows, not just the current page. Edit a transaction or its allocations from its detail page, not inline in lists.

Internal transfers have Groups and Suggestions views with search, account/date filters and whole-group pagination. Groups can also be filtered by balance or allocation imbalance. A matching member keeps the entire group visible. Bulk linking applies only to the suggestions explicitly shown on the current page. The separate manual-creation panel retains selected candidates while browsing its pages/filters. Its selections are local to the page, not saved across reloads. Transfer details show net allocation balances alongside amounts moved: matched incoming/outgoing amounts counted once, not their zero net or a doubled total. Unbalanced transfers also show incoming and outgoing amounts for reconciliation.

The **Warnings** page gathers unbalanced transfers, per-project transfer allocation imbalances, non-ignored checkpoint mismatches, and CSV/import issues, with shared pagination and links to the affected records. Ignored checkpoints are not warnings. Account pages show only the latest checkpoint by default; earlier checkpoints and the checkpoint creation form are collapsible. Warning links reveal older affected checkpoints automatically.

The initial language follows the browser's preferred supported language (English or French, including regional variants), falling back to English. An explicit language selection takes precedence and is remembered in the locale cookie.

Traefik rejects encoded path separators/control characters and ambiguous header aliases, and caps forward-auth responses at 1 MiB. These settings do not restrict encoded query parameters or change the app's upload-body limits above.

### Data commit identities

Request-driven data commits use the authenticated Authelia identity as author: `Remote-Name` (falling back to `Remote-User`) and `Remote-Email`. Missing or invalid emails fall back to `<username>@users.invalid`, with unsafe local-part characters replaced by hyphens. Names are stripped of control characters and angle brackets. Development mode uses `Development user <dev@users.invalid>`.

The app remains the committer, configured by `GIT_AUTHOR_NAME` and `GIT_AUTHOR_EMAIL` (defaults: `comptes app <comptes@app.local>`). Despite their legacy names, these settings control the committer; operations outside an HTTP request also use them as the author. Request identity is scoped with AsyncLocalStorage, so all repository/configuration/import commit paths inherit the same author without process-global identity changes or per-action omissions. Only trust identity headers supplied by the authenticating proxy; do not expose the app port directly to untrusted clients.

## Transaction filters and third-party amounts

Transaction lists on the dashboard, accounts, projects, Unallocated and third-party pages share a collapsible filter form. Active filters open it automatically; the page's fixed dimensions are hidden. Search, date range, account, third party, category, payment mode, project, allocation status, record type and exclusion filters are combined. Unallocated always omits excluded transactions and ignores project/allocation-status filters. Unknown URL parameters survive filtering; changing a filter resets pagination, while page links preserve the filters.

Project, category, payment-mode and third-party labels filter the current list. Small ↗ links keep navigation to project and third-party details available. Summaries use all matching rows, not just the current page. Internal transfer visibility only hides rows; it never changes sums or summary counts. Account current balances/checkpoints remain actual balances, not filtered cash-flow sums. Existing excluded-amount rules remain unchanged (project allocation totals retain their existing semantics; account/transaction flow sums omit excluded amounts).

Third-party list/detail amounts use the third party's point of view: transaction and allocation amounts and net totals are negated, and incoming/outgoing are swapped and negated. This display convention does not modify stored accounting amounts or allocation editors, which remain in the app's accounting perspective.
