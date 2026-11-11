# comptesperance

Bilingual accounting app backed by a local git data repository, with a disposable SQLite cache.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` if you want to change `DATA_REPO_PATH`, `CACHE_DB_PATH`, or disable auth locally.

## Tests and checks

```bash
npm run check
npm run lint
npm run test:unit -- --run
npm run build
```

## Docker Compose with Traefik + Authelia

```bash
docker compose up --build
```

Open:

- App: https://comptes.localhost:8443
- Authelia portal: https://auth.comptes.localhost:8443

Authelia 4.39 requires HTTPS and a non-localhost cookie domain, so local testing uses `localhost` with Traefik TLS on port 8443. The first certificate is self-signed; accept the browser warning, sign in at the Authelia portal, then open the app.

Ready-to-use local users:

- `alice` / `alice` — `comptes-readwrite`
- `bob` / `bob` — `comptes-readonly`

Compose mounts the data git repo at `/data` and the disposable SQLite cache at `/cache`.

### Non-root runtime and existing volumes

The app image runs as `node` (UID/GID 1000:1000), not root. Its defaults are
`DATA_REPO_PATH=/data` and `CACHE_DB_PATH=/cache/comptes.sqlite`. The image owns
both directories, so Docker initializes fresh named volumes with the correct
ownership. Documents/evidence under `/data/documents` and Git's `/data/.git`
are created by that same user. Bind mounts must likewise be writable by UID 1000.

Do not run the app as root or make volumes world-writable. Ownership also makes
the data repository safe for Git; no `safe.directory=*` exemption is needed.
No writable global Git configuration is required.

### Full-stack Playwright tests

The E2E suite uses the real Traefik + Authelia + app stack, including the committed
local fixture users above. Never point it at production: it creates accounts,
transactions, projects, documents and repeated CSV imports. A fresh Compose
project gives each run isolated data, cache and Authelia volumes.
Only one stack can bind ports 8080/8443 at a time; stop any existing stack first
without deleting its volumes.

```bash
npm ci
npx playwright install --with-deps chromium # or set PLAYWRIGHT_CHANNEL=chrome to use installed Google Chrome
export COMPOSE_PROJECT_NAME="comptes-e2e-$(date +%s)"
docker compose up -d --build --wait --wait-timeout 120
docker compose exec app id # uid=1000(node)
PLAYWRIGHT_BASE_URL=https://comptes.localhost:8443 npm run test:e2e
docker compose down --volumes # deletes only this disposable project's data
```

Playwright ignores the local self-signed certificate. Chromium resolves
`*.localhost` to loopback; if Node/curl on your machine does not, add
`127.0.0.1 comptes.localhost auth.comptes.localhost` to `/etc/hosts`.
`PLAYWRIGHT_BASE_URL` defaults to the Compose app URL; Authelia/Traefik host rules
must still match the URL you use.

Tests cover signed-out redirects and return URLs, read-only permission checks,
writer edit-mode switching, account/manual transaction/project allocation writes,
a 2 MiB evidence upload and download, CCP/SumUp imports and stable rows/IDs on
reimport, and sign-out. No preview server or auth bypass is used.
`playwright-report/` contains the HTML report; failed tests retain screenshots
and traces under `test-results/`.

CI builds a fresh project per run, waits for service health, checks the non-root
UID and runs this suite with the runner's preinstalled Google Chrome
(`PLAYWRIGHT_CHANNEL=chrome`), so it downloads no browser or system packages. On failure it uploads the Playwright report,
traces/screenshots and Compose logs, then always tears down the test volumes.

Traefik uses Authelia's `/api/authz/forward-auth` endpoint, which handles redirects
to sign-in and supplies trusted identity headers. The app itself returns 401 for
requests without identity headers and 403 for signed-in users without an allowed
group; it does not redirect to sign-in. The sidebar/mobile menu Sign out link uses
`AUTH_LOGOUT_URL` with the app origin in `rd`. Defaults match the Compose URLs
above. Deployments using other domains must also update Authelia's cookie domain,
portal/default redirect URLs and access rules, and Traefik's host rules.

Authelia uses `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET` for its
reset-password token secret (not the deprecated `AUTHELIA_JWT_SECRET`). Its binary
starts directly because the mounted configuration files are deliberately read-only;
the image's ownership-changing wrapper is unnecessary here.
Traefik rejects encoded path separators/control characters and ambiguous header
aliases, and caps forward-auth responses at 1 MiB. These settings do not restrict
encoded query parameters or change the app's upload-body limits below.

Writers start in read-only display. Use **Switch to edit mode** to enable editing,
and **Return to read-only** to disable it. The POST-only toggle stores an HttpOnly,
SameSite=Strict session cookie; the server rejects writes unless both the write
role and edit mode are present. Read-only users cannot enable edit mode.
`AUTH_DISABLED=true` behaves as a writer but also starts read-only and hides Sign out.

### Data commit identities

Request-driven data commits use the authenticated Authelia identity as author:
`Remote-Name` (falling back to `Remote-User`) and `Remote-Email`. Missing or invalid
emails fall back to `<username>@users.invalid`, with unsafe local-part characters
replaced by hyphens. Names are stripped of control characters and angle brackets.
Development mode uses `Development user <dev@users.invalid>`.

The app remains the committer, configured by the existing `GIT_AUTHOR_NAME` and
`GIT_AUTHOR_EMAIL` environment variables (defaults: `comptes app <comptes@app.local>`).
Despite their legacy names, these settings control the committer; operations outside
an HTTP request also use them as the author. Request identity is scoped with
AsyncLocalStorage, so all repository/configuration/import commit paths inherit the
same author without process-global identity changes or per-action omissions.
Only trust identity headers supplied by the authenticating proxy; do not expose
the app port directly to untrusted clients.

## Upload limits

`MAX_EVIDENCE_BYTES` limits each document/evidence file (default 26214400 bytes,
25 MiB). `BODY_SIZE_LIMIT` is adapter-node's total HTTP request-body limit, including
all files and multipart overhead. Docker and Compose default to `100M` (100 MiB);
both settings can be overridden through environment variables. Keep the total
limit above the per-file limit, allowing headroom for multi-file batches. Split
large batches across requests; four maximum-size files plus multipart overhead
will exceed 100 MiB.

When running `node build` directly, explicitly set `BODY_SIZE_LIMIT=100M`:
adapter-node otherwise defaults to 512 KiB, well below the app's per-file limit.
For local HTTP production testing also set `ORIGIN=http://localhost:<port>`.
Traefik's supplied configuration has no buffering/body-limit middleware. Other
upstream proxies may impose their own limits and must be configured separately.
Per-file and request-body rejections are shown as bilingual upload errors.

## Data repository format

`/projects/unallocated` is a computed view, not a stored project. It lists non-excluded
transactions with a non-zero unallocated remainder (transaction amount minus allocations).
Incoming/outgoing/net totals always include internal transfers; the internal transfer toggle only hides rows.
Per-account breakdowns omit net-zero accounts. In edit mode, Allocate links open the existing
transaction allocation editor.

The git data repository is the source of truth; SQLite is disposable and rebuilt
from these files. All monetary amounts are integer cents in EUR. No migration or
legacy-format compatibility is provided.

- `config/app.json`: `{ "name": "Comptesperance" }`.
- `config/categories.json`: `[{ "id": "dons", "name": "Dons", "kind": "income", "archived": false }]`;
  kind is `income` or `expense`.
- `config/payment-modes.json`: `[{ "id": "carte", "name": "Carte bancaire", "archived": false }]`.
  Missing config files are initialized with French defaults and committed.
  Settings edits each make one data-repository commit. Used entries can be archived
  but not deleted.
- `accounts/<id>/account.json`: `{ "account": { "id": "...", "name": "...", "source": "manual", "notes": "...", "created_at": "...", "updated_at": "..." }, "transactions": [] }`.
  CSV accounts omit `transactions` and keep unchanged CSV imports in `statements/`.
  Accounts have no type, currency or opening-balance field. Optional top-level
  `checkpoints` in `account.json` store manual end-of-day balances:
  `[{ "id": "...", "date": "2026-10-02", "balance_cents": 20000, "note": "Cash count" }]`.
  They are available for both manual and CSV accounts. Statement checkpoints are
  derived only in SQLite from every CCP header date and balance; SumUp has none.
  Current balance uses the latest checkpoint (statement preferred on date ties)
  plus non-excluded transactions on later calendar days. Without a checkpoint,
  balance starts at zero. Every earlier checkpoint is reconciled against the latest
  anchor; differences are recorded minus computed balances. Same-source/date ties
  use checkpoint ID order for a stable anchor, retaining all checkpoints for comparison.
  Optional initial balance/date on account creation creates one manual checkpoint
  in the same data-repository commit.
- Manual transactions have `id`, `date`, `amount_cents`, `label` and optional
  `description`, `notes`, `third_party_id`, `category_id`, `payment_mode_id`,
  `excluded`, `evidence`, a shared `transfer_id` and timestamps.
- `accounts/<id>/annotations.json` for CSV accounts maps transaction IDs to
  annotation objects: optional notes, category/payment-mode/third-party IDs,
  evidence, a shared `transfer_id`, excluded and allocations.
  Internal transfers group two or more transactions across at least two accounts. Groups may
  be unbalanced; amount and per-project allocation imbalances are warnings. Removing
  a member dissolves groups with fewer than two members or accounts. CSV parsed value dates
  and statuses are retained for display. Cancelled SumUp transactions default to
  excluded; an explicit annotation overrides that default.
- Allocations belong to each manual transaction or CSV annotation:
  `"allocations": [{ "project_id": "kermesse", "amount_cents": 1250, "note": "Part" }]`.
  A project appears at most once per transaction; amounts have the transaction's
  sign and their absolute sum cannot exceed its absolute amount.
- `projects/<id>.json` contains only `id`, `name`, optional `description`,
  `created_at`, `updated_at`. Hiding internal transfers only filters displayed rows:
  totals and summary counts always include internal transfer members, including project allocations.
  Orphan allocations are ignored. Deleting a project removes its allocations from all manual transactions
  and CSV annotations in the same commit.
- SumUp CSV formats are unchanged. Accepted sales use gross amounts; a derived
  fee transaction has id `<sale fingerprint>:fee` and a negative amount.
  Fees support the same annotations and exclusions as any CSV transaction.
  Settlements use the net payout on the payout date. Sale descriptions and detail
  links join the sale, fee and settlement across the account's statement set.
- `/transfers` suggests complete balanced internal transfer payout-ID groups (SumUp settlements
  plus the CCP credit), followed by exact opposite-amount pairs within seven days.
  Suggestions exclude linked/excluded transactions and do not overlap; bulk linking
  writes all groups in one data-repository commit. Amount and project-allocation
  imbalances on manually assembled groups remain visible warnings.
- `third-parties/<id>.json` and `documents/` retain their existing formats.
  Evidence paths can be shared by multiple transactions.

## Transaction filters and third-party amounts

Transaction lists on the dashboard, accounts, projects, Unallocated and third-party
pages share a collapsible filter form. Active filters open it automatically; the
page's fixed dimensions are hidden. Search, date range, account, third party,
category, payment mode, project, allocation status, record type and exclusion
filters are combined. Unallocated always omits excluded transactions and ignores
project/allocation-status filters. Unknown URL parameters survive filtering;
changing a filter resets pagination, while page links preserve the filters.

Project, category, payment-mode and third-party labels filter the current list.
Small ↗ links keep navigation to project and third-party details available.
Summaries use all matching rows, not just the current page. Internal transfer
visibility only hides rows; it never changes sums or summary counts. Account
current balances/checkpoints remain actual balances, not filtered cash-flow sums.
Existing excluded-amount rules remain unchanged (project allocation totals retain
their existing semantics; account/transaction flow sums omit excluded amounts).

Third-party list/detail amounts use the third party's point of view: transaction
and allocation amounts and net totals are negated, and incoming/outgoing are
swapped and negated. This display convention does not modify stored accounting
amounts or allocation editors, which remain in the app's accounting perspective.
