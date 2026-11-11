# Comptes d’espérance

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

Authentication uses Authelia's trusted identity headers. Unauthenticated page
requests redirect to `AUTH_LOGIN_URL` with the full requested URL in `rd`;
unauthenticated actions return 401. The sidebar/mobile menu Sign out link uses
`AUTH_LOGOUT_URL` with the app origin in `rd`. Defaults match the Compose URLs
above. Deployments using other domains must also update Authelia's cookie domain,
portal/default redirect URLs and access rules, and Traefik's host rules.

Writers start in read-only display. Use **Switch to edit mode** to enable editing,
and **Return to read-only** to disable it. The POST-only toggle stores an HttpOnly,
SameSite=Strict session cookie; the server rejects writes unless both the write
role and edit mode are present. Read-only users cannot enable edit mode.
`AUTH_DISABLED=true` behaves as a writer but also starts read-only and hides Sign out.

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
