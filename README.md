# بصيرة · Basira — Phase 1 (prize-free MVP)

A free forecasting platform for Saudi Arabia. Users forecast real-world outcomes that resolve
within 24 hours, choose a confidence level (60 / 75 / 90%), earn accuracy scores, climb weekly
leagues and challenge friends to duels.

**There is no money anywhere.** Points are a score, not a balance. Nothing can be bought,
deposited, transferred or cashed out. Duels give only a badge and a separate challenge rating.
See [`CLAUDE.md`](CLAUDE.md) for the guardrails, [`PLAN.md`](PLAN.md) for the milestones and
[`DECISIONS.md`](DECISIONS.md) for choices the spec left open.

> The platform name is a placeholder ("بصيرة / Basira"). Change it in `packages/shared/src/brand.ts`,
> `apps/web/messages/*.json` (`common.appName`) and `apps/web/public/manifest.webmanifest`.

---

## Quick start: everything in Docker (about 5 minutes)

Requirements: Docker with Compose v2.

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, a one-shot `migrate` job (migrations plus seed data), the API on
`:4000` and the web app on `:3000`.

1. Open http://localhost:3000. The app is in Arabic, and the **English** button switches language.
2. Sign in with one of the seeded accounts. The one-time code is printed in the API log, because
   the console SMS provider is used in development:

   ```bash
   docker compose logs -f api | grep OTP
   ```

   | Role | Phone |
   |------|-------|
   | Editor | `0500000001` |
   | Reviewer | `0500000002` |
   | Admin | `0500000003` |
   | Demo player (has history, friend leagues, a Best-of-3 challenge) | `0500000004` |

   A new number goes through onboarding: 18+ → nickname and city → 3 interests → warm-up questions.
3. Staff accounts see **الإدارة / Admin** in the header. From there they can create questions
   (from scratch or a template), run the publish checklist, review, resolve, confirm, void,
   correct, handle disputes and read the audit log.

> Behind a TLS-intercepting corporate proxy, build with
> `docker build --secret id=ca,src=/path/ca.crt --build-arg HTTPS_PROXY=... -f apps/api/Dockerfile .`
> (the web Dockerfile accepts the same options).

## Local development (hot reload)

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d postgres redis
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

`pnpm dev` runs the web app at http://localhost:3000 and the API at http://localhost:4000. One-time
codes are printed in the API terminal. To wipe the dev data and start again, run `pnpm db:reset`
and then `pnpm db:seed`.

### Tests

```bash
pnpm test
```

This runs the unit tests (`packages/shared`: scoring, Elo, duel outcomes, leagues, streaks,
badges, time, and the banned-word scan) and the API integration tests (`apps/api/test`, real
Postgres and Redis, using the `forecast_test` database and Redis DB 1).

The end-to-end tests need a running stack with `ENABLE_TEST_ROUTES=true` (the default in
`.env.example` and `.env.docker`):

```bash
pnpm e2e
```

They cover two required flows (sign-up → forecast → two-person resolution → score and league →
share card; and a full duel), an axe accessibility scan of the main screens in Arabic and English,
and keyboard operation. To point them at another stack, set `E2E_BASE_URL` and `E2E_API_URL`.

## Architecture

```
apps/web      Next.js 15 App Router PWA, Tailwind 4 (logical properties), Arabic-first RTL
apps/api      NestJS 11: REST under /api, Socket.IO (crowd %, inbox pings), BullMQ workers
packages/db   Prisma 6 schema, migrations, seed
packages/shared  pure, unit-tested logic: scoring, Elo, duels, leagues, streaks, badges,
                 Riyadh time, formatting, zod schemas, templates, checklist, banned words
e2e           Playwright
```

- **Forecast writes** are queued (BullMQ `forecasts`). The lock time is enforced on the server at
  the API edge and again in the worker.
- **Crowd %** comes from Redis hash counters and is pushed over Socket.IO. Events fan out through
  Redis pub/sub, so any number of API instances work.
- **Leaderboards** are Redis sorted sets (week, season, season×category). They are updated from
  score deltas and rebuilt from Postgres when they are missing.
- **Jobs**: lock at lockAt, finalize 12h after resolution, a Sunday 00:00 Riyadh league rollover,
  duel expiry, quiet-hours notification delivery and season close. Delayed or cron jobs run them,
  with a 15-second sweeper as a safety net.
- **Share cards** are rendered as HTML → PNG by headless Chromium with the embedded IBM Plex Sans
  Arabic font, so Arabic letters shape and join correctly (this is checked by a test). They are
  stored in Postgres, so no object storage is needed.
- **Web Push** uses standard VAPID (`web-push`). Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
  (generate them with `pnpm --filter @app/api exec web-push generate-vapid-keys`). Without them,
  notifications still reach the in-app inbox.
- `API_ROLE=web|worker|all` splits HTTP/socket processes from queue workers when scaling.

## Deploying (any cloud, including KSA regions)

Only portable building blocks are used: two OCI images, PostgreSQL 14+, Redis 7, and any HTTPS
reverse proxy or load balancer. There are no vendor-specific services.

1. Build and push the images:

   ```bash
   docker build -f apps/api/Dockerfile --target runtime -t REGISTRY/forecast-api:TAG .
   ```

   ```bash
   docker build -f apps/api/Dockerfile --target migrate -t REGISTRY/forecast-migrate:TAG .
   ```

   ```bash
   docker build -f apps/web/Dockerfile -t REGISTRY/forecast-web:TAG .
   ```

2. Provision PostgreSQL and Redis inside the Saudi region (data residency under the PDPL). Set Redis
   `maxmemory-policy noeviction`, because BullMQ requires it.
3. Run `forecast-migrate` once per release, with `SEED` unset.
4. Run `forecast-api` with the environment below, then `forecast-web` with `API_INTERNAL_URL`
   (the API's internal URL) and `PUBLIC_SOCKET_URL` (the public origin that serves `/socket.io`).
5. Reverse proxy: route `/api/*` and `/socket.io/*` (with WebSocket upgrade) to the API, and
   everything else to web. Serve both on one HTTPS origin.

API environment for production:

| Variable | Notes |
|----------|-------|
| `NODE_ENV=production` | Always. This also hard-disables the test routes. |
| `DATABASE_URL`, `REDIS_URL` | Use in-region managed or self-hosted instances. |
| `JWT_SECRET`, `PHONE_PEPPER` | 32+ random bytes each (`openssl rand -hex 32`). Never rotate the pepper: phone lookups depend on it. |
| `PHONE_ENC_KEY` | 64 hex characters (AES-256-GCM). Keep it in a secret manager. |
| `WEB_ORIGIN` | Public web origin(s), comma-separated (CORS for sockets). |
| `COOKIE_SECURE=true` | Use this behind HTTPS. |
| `VAPID_*` | Web Push keys. |
| `SMS_PROVIDER` | Implement `SmsProvider` (`apps/api/src/auth/sms`) for your SMS gateway and register it in `AuthModule`. |
| `ENABLE_TEST_ROUTES` | Must be unset or `false`. |
| `API_ROLE` | `web` for HTTP replicas, `worker` for one or more job runners, or `all`. |

## Guardrails enforced in code

- Forecasts are accepted only before `lockAt`, judged on server time (`canForecast`, the worker re-check, and tests).
- There are no payment, balance, transfer or prize code paths. Elo lives only in `DuelRating`.
- The banned-word test scans every translation file and all source files.
- Quiet hours (23:00–07:00 Riyadh) are respected by notification scheduling (tests).
- Users must confirm 18+ before any feature works, enforced by a global guard (tests).
- The reviewer must differ from the creator, and the confirmer from the resolver (tests). Every admin action is audit-logged.
- PDPL: `GET /api/me/export` and `DELETE /api/me` (hard delete). Only phone, nickname, city and interests are collected.
