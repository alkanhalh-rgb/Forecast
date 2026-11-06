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
| M2 | Questions, feed, forecasting (queued), crowd % (Redis + WS), server lock, admin create/review/publish, templates | ✅ |
| M3 | Resolution (two-person), void, disputes, scoring jobs, seasons, accuracy rating, finalize, corrections | ✅ |
| M4 | Weekly leagues (groups of 30, 5 divisions, promotion/relegation) and leaderboards (week/season/category/friends) | ✅ |
| M5 | Duels SINGLE and BEST_OF_3, Elo, pair limit, expiry | ✅ |
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

### M2 ✅
- Feed (LIVE, soonest lock first, category chips) and question page (source, lock, confidence chips 60/75/90 with a score preview).
- Forecasts are written by a queue worker (BullMQ). The API waits up to 3s, then returns 200 or 202. The last submission wins, by submission time. ForecastHistory is kept.
- Lock is enforced on the server at the API edge and again in the worker. A delayed lock job runs at lockAt, with a 15s sweeper as backup. The crowd snapshot is stored at lock.
- Crowd % comes from Redis hash counters. It is hidden until the user forecasts, then pushed live over Socket.IO, fanned out through Redis pub/sub so it works across instances.
- Admin: create, edit, templates (TASI, Brent, weather, SPL match), publish checklist (automatic checks plus attestations, re-checked at publish), reviewer ≠ creator, audit log for every action.
- Tests: 22 API integration tests (lock enforcement, last-wins, crowd visibility, rate limit, admin flow and checklist). A browser smoke test confirmed a live crowd update reaches the page.

### M3 ✅
- Resolution is two-person: an editor proposes the outcome and source, and a different staff member confirms it. Scores are only written on confirm.
- Scoring uses the shared formula. Scores carry season and week attribution from the first resolution. Seasons are created lazily (6 weeks).
- Finalization: a delayed job plus a sweeper make a question FINAL 12h after resolution, and only when no dispute is open.
- Disputes: forecasters can report during the window (once each). There is an admin queue to decide them, plus a `dispute.decided` event (used for notifications in M6).
- Void (4 reasons) removes all scores. FINAL questions can only be voided by an admin. Corrections are admin-only: they re-score everyone and show a public note. Everything is audit-logged.
- `/me/stats`: season points, week points, scored count, and the accuracy rating (null below 20).
- Tests: 30 API integration tests in total pass.

### M4 ✅
- Weekly leagues: a user joins a group on their first forecast or score of the Riyadh week. Group assignment is serialized with a Postgres advisory lock, and groups fill to 30. Divisions carry over from the last result.
- Rollover: a BullMQ cron runs `0 0 * * 0` in Asia/Riyadh, with a sweeper as backup. It ranks each group (points, then join time) and records top 5 UP and bottom 5 DOWN, bounded at divisions 1 and 5.
- Leaderboards are Redis sorted sets for week, season and season×category, updated by score deltas, so corrections and voids adjust them. The friends board uses ZMSCORE. A rebuild-from-DB is available.
- Leaderboard data contains nicknames only. Tests assert that no phone data appears.
- Web: `/league` (group table with promotion and relegation zones) and `/leaderboards` (tabs).
- Tests: 34 API integration tests pass.

### M5 ✅
- SINGLE duel: the challenger picks a question and answer and shares a link (or names an opponent by nickname). The opponent must pick a different option.
- BEST_OF_3: Q1 from the challenger, Q2 from the opponent, Q3 picked at random by the system from LIVE questions locking within 24h. Q3 answers are independent, and the other side's pick stays hidden until lock.
- Outcomes use the shared `duelOutcome`: ties, voids as no result, all-void → VOID. Duels are decided on scoring and re-decided on void or correction. Stored Elo deltas are reversed exactly.
- Elo: start 1200, K = 32, tie = 0.5, stored only in `DuelRating`. Tests assert that no Score rows or season points come from duels.
- Pair limit: 3 per Riyadh week. Unaccepted challenges expire at the question lock (sweeper). Duel creation and acceptance are rate limited.
- Web: duel list with rating, a create page, and a duel page (share link, accept, answer Q2/Q3). No stake wording anywhere.
- Tests: 44 API integration tests pass.
