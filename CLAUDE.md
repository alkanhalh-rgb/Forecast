# CLAUDE.md — working rules for this repository

This is Phase 1 (prize-free MVP) of a free Saudi forecasting platform. Users forecast
real-world outcomes that resolve within 24 hours, pick a confidence level, earn accuracy
scores, climb weekly leagues and challenge friends. **No money, ever, in Phase 1.**

The platform name is still a placeholder. It lives in one config value
(`PLATFORM_NAME_AR` / `PLATFORM_NAME_EN` in `packages/shared/src/brand.ts`); never hard-code it elsewhere.

## Non-negotiable guardrails (Sharia + legal). Enforced in code and tests.

1. Nothing can be bought, deposited, staked, transferred between users, or cashed out.
   There is no payment code, SDK, endpoint or table in Phase 1.
2. Points are a **score**, not a balance. They are never spent and never move between users.
   There is no "balance" column and no endpoint that moves points.
3. Duels have nothing at stake. The winner gets a badge and an Elo gain. Elo
   (`DuelRating`) is fully separate from season points, `Score` and leaderboards.
4. Banned vocabulary, in UI, code, comments and copy, in both languages. The list is
   in `packages/shared/src/banned-words.ts` (the only file allowed to contain the words).
   `packages/shared/test/banned-words.test.ts` scans all translation files and source files.
   Use: توقع (forecast), ثقة (confidence), دقة (accuracy), تحدي (challenge).
5. No loot boxes, spin wheels, random rewards, near-miss animations or paid features.
   (Random *question selection* for Best-of-3 duel Q3 is not a reward.)
6. No notifications between 23:00 and 07:00 Asia/Riyadh: they are queued until 07:00.
7. Users must confirm they are 18+ at sign-up (`ageConfirmedAt` required to use the app).

Phase 2/3 items are out of scope: payments, prizes, sponsors, ads, premium, native app.
Leave extension points only (see `DECISIONS.md` → "Future Sponsor/Prize").

## Formatting rules

- Arabic first, RTL; English second (toggle). Use Tailwind **logical** utilities
  (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`), never `ml/mr/pl/pr/left/right`.
- Western numerals (0-9) everywhere: always format with `formatNumber`/`formatDateTime` from
  `@app/shared` (locale `ar-SA-u-nu-latn-ca-gregory`), never raw `toLocaleString()`.
- All times shown in `Asia/Riyadh`. Week starts Sunday 00:00 Riyadh. Riyadh is UTC+3 with no DST.
- Font: IBM Plex Sans Arabic (self-hosted via `@fontsource`), for Latin text too.
- Mobile-first.

## Repo map

- `apps/web` Next.js App Router PWA (Tailwind v4)
- `apps/api` NestJS REST + Socket.IO + BullMQ workers
- `packages/db` Prisma schema, migrations, seed
- `packages/shared` pure logic (scoring, Elo, duels, leagues, streaks, badges, time, i18n helpers, zod)
- `e2e` Playwright tests

## Commands

- `pnpm i` · `docker compose up -d postgres redis` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm dev`
- `pnpm test` (unit + API integration) · `pnpm e2e` (Playwright, needs running stack)
- `pnpm lint` · `pnpm typecheck`

## Working method

- Pure logic goes in `packages/shared` with unit tests. The API wraps it.
- Time comes from `ClockService` (API) so tests can control it; never call `new Date()` in domain code.
- Every admin action writes an `AuditLog` row (use `AuditService.log`).
- The server is the source of truth: lock time, roles, two-person rules and limits are checked on the API.
- Record any choice not covered by the spec in `DECISIONS.md`.
- Ask the product owner before any major change to the spec.
