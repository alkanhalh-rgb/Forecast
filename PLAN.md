# PLAN

## Architecture (short)

```
browser (PWA, Next.js) ──/api/* rewrite──► NestJS API ──► PostgreSQL (Prisma)
        └──── Socket.IO (/socket.io) ─────►    │     └──► Redis: sorted sets (leaderboards),
                                               │                 hashes (crowd counters),
                                               │                 BullMQ queues, rate limits, OTP
                                               └── BullMQ workers (same process, can be split):
                                                   forecasts, question lock, scoring, finalize,
                                                   league rollover, duels, notifications, share cards
```

- One NestJS process serves REST and Socket.IO and runs workers. `API_ROLE=web|worker|all` lets ops split them.
- Next.js proxies `/api/*` to the API, so cookies stay same-origin. In production a reverse proxy routes
  `/api` and `/socket.io` to the API service.
- Share cards: HTML rendered to PNG by headless Chromium (playwright-core). This gives correct Arabic shaping.
- Web push: standard Web Push (VAPID) via `web-push`. There is no vendor SDK.

## Milestones

| # | Scope | Status |
|---|-------|--------|
| M1 | Monorepo, docker-compose, Prisma schema + migration, auth (OTP) + onboarding, i18n/RTL shell | ✅ |
| M2 | Questions, feed, forecasting (queued), crowd % (Redis + WS), server lock, admin create/review/publish, templates | ☐ |
| M3 | Resolution (two-person), void, disputes, scoring jobs, seasons, accuracy rating, finalize, corrections | ☐ |
| M4 | Weekly leagues (groups of 30, 5 divisions, promotion/relegation) and leaderboards (week/season/category/friends) | ☐ |
| M5 | Duels SINGLE and BEST_OF_3, Elo, pair limit, expiry | ☐ |
| M6 | Friend leagues, streaks + shields, badges, share cards, web push + quiet hours | ☐ |
| M7 | PDPL export/delete, banned-word test, a11y pass, seed data, Dockerfiles, README | ☐ |

Each milestone ends with: all tests green, a summary in the progress log below, and a git commit.

## Progress log

### M1 ✅
- pnpm + Turborepo monorepo: `apps/api` (NestJS 11), `apps/web` (Next 15 + Tailwind 4), `packages/db` (Prisma 6), `packages/shared`.
- docker-compose: postgres 16, redis 7, plus migrate/api/web services.
- Full Prisma schema for every spec entity, plus PushSubscription, Notification and ShareCard. Initial migration added.
- Auth: phone + OTP behind an `SmsProvider` interface (ConsoleProvider). 5-minute TTL, 5 requests per number per hour, 5 attempts per code. Phone stored as HMAC hash + AES-GCM ciphertext. JWT httpOnly cookie.
- Onboarding API and UI: 18+ and privacy consent (logged in `consentLog`) → nickname + city → 3 interests → warm-up.
- Global guard: session → onboarding gate (rule 7) → roles → Redis rate limits.
- i18n shell: Arabic-first RTL, English toggle (cookie), IBM Plex Sans Arabic, Western numerals, PWA manifest and service worker.
- Tests: 67 shared unit tests and 7 API integration tests (auth, OTP limits, onboarding) pass. A browser smoke test of login → onboarding passes.
