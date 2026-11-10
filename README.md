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

- App: http://comptes.localhost:8080
- Authelia portal: http://auth.localhost:8080

Ready-to-use local users:

- `alice` / `alice` — `comptes-readwrite`
- `bob` / `bob` — `comptes-readonly`

Compose mounts the data git repo at `/data` and the disposable SQLite cache at `/cache`.
