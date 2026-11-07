# DECISIONS

Choices that the spec does not cover. Each entry gives the decision and the reason. Ask the product owner to confirm any marked **(confirm)**.

## Product / domain

1. **Working name (confirm).** The spec leaves the platform name as a placeholder. The working name is
   "بصيرة / Basira", set in `packages/shared/src/brand.ts` and nowhere else. Package scope is the neutral `@app/*`.
2. **Phone numbers.** Only Saudi mobile numbers (`+9665XXXXXXXX`) are accepted. `05XXXXXXXX`, `5XXXXXXXX` and `009665…` are
   normalized to that form. `phoneHash` = HMAC-SHA256(`PHONE_PEPPER`, E.164). `phoneEncrypted` = AES-256-GCM(`PHONE_ENC_KEY`).
3. **OTP.** 6 digits, stored hashed in Redis for 5 minutes, at most 5 wrong attempts per code, at most 5 code requests
   per number per hour, plus an IP limit (20 requests per hour).
4. **Sessions.** A signed JWT (HS256, 30 days) in an httpOnly `SameSite=Lax` cookie. The user and role are reloaded
   from the DB on every request, so role changes and deletions take effect immediately.
5. **Onboarding order.** Phone → code → 18+ confirmation plus privacy consent → nickname and city → 3 interests →
   3 warm-up questions (LIVE questions that resolve today in Riyadh). If fewer than 3 such questions exist, the user
   answers what is available and may continue.
6. **Score attribution.** A score belongs to the week and season in which its question was *first resolved*.
   A later correction changes the points but keeps that week and season.
7. **Accuracy rating.** The average score of forecasts on questions resolved in the last 30 days. It is shown only when
   the user has 20 or more scored (non-void) forecasts in total. Otherwise the API returns `null` and the count so far.
8. **Seasons.** These are consecutive 6-week windows anchored at Sunday 2026-01-04 00:00 Riyadh (`SEASON_ANCHOR`).
   They are created lazily.
9. **Divisions.** Division 1 is the entry (lowest) division and 5 is the top. New users start in division 1.
   A user joins a weekly league group the first time they forecast or score in that week. Groups are filled up to 30
   in join order.
10. **Small groups.** For a group of n members, promotion and relegation each move `min(5, floor(n/2))` users,
    so the same user can never be moved both ways. Division 5 users can't move up and division 1 users can't move down
    (they `STAY`). Ties in weekly points are broken by earlier join time.
11. **Friends leaderboard.** "Friends" means every user who shares at least one friend league with you, plus you.
12. **Duel picks and forecasts.** Duel picks are stored in `DuelQuestion` only. They do not create forecasts and
    never affect points.
13. **Best of 3 picking.** Q1 is answered by the challenger first, and the opponent must choose a different option.
    Q2 is answered by the opponent first, and the challenger must choose a different option. Q3 is answered
    independently by both, and the same option is allowed. Each player answers each question before its lock.
    A missing answer counts as not picking the winning option.
14. **Direct challenges.** A duel can be shared by link (open to anyone) or sent to a nickname. The 3-per-week pair
    limit is checked when the duel is created (if the opponent is known) and when it is accepted. It counts
    ACTIVE/DONE/VOID duels that the pair created in the same Riyadh week.
15. **Duel decision time.** A duel is decided when its questions are scored (RESOLVED), not at FINAL. If a question is
    later voided or corrected, the duel is recomputed. The Elo deltas stored on the duel are reversed and the new ones
    applied.
16. **Templates.** These are code-defined in `packages/shared/src/templates.ts`: TASI daily close, Brent daily settle,
    Riyadh max temperature tomorrow, and a Saudi Pro League match. An editor creates a DRAFT from a template with
    parameters, then goes through the normal checklist and review. Nothing auto-publishes.
17. **Publish checklist.** Some items are checked automatically: a source name plus an https URL, resolveBy at most
    24h after publish, lockAt after now and before resolveBy, no banned words, no blocked-topic keywords, and at least
    2 unique non-empty options. Editors attest the rest (lock before outcome is public, topic not blocked, neutral
    wording, options exclusive and exhaustive), and reviewers re-attest them on approval. All of it is stored on
    `Question.checklist`.
18. **Who confirms.** The person who confirms a resolution must be a staff user (editor, reviewer or admin) other than
    the person who entered it. Corrections after FINAL are admin-only and audit-logged.
19. **Finalization.** A RESOLVED question becomes FINAL 12h after resolution. If disputes are still open, it waits
    until they are decided.
20. **Void.** Reasons are `POSTPONED`, `ABANDONED`, `SOURCE_UNAVAILABLE_48H` and `AMBIGUOUS`. A question can be voided
    from LIVE, LOCKED, RESOLVED or FINAL (admin). Voiding deletes its scores and adjusts leaderboards.
21. **Share cards.** Cards are bilingual (Arabic headline plus English line), so no locale preference is stored. PNGs
    are kept in the DB (`ShareCard.image`) so that no object storage is needed.
22. **Data minimization.** The UI language preference is a cookie only. The DB has no locale, email, real name or
    device data. Push subscriptions are stored only when the user enables notifications.
23. **Account deletion.** This is a hard delete of the user and everything owned by them: forecasts, scores,
    memberships, streak, badges, duel rating, duels they took part in, friend-league memberships, disputes and push
    subscriptions. Redis leaderboard entries and the live crowd counters of unlocked questions are removed too.
    Audit rows keep the action but `actorId` is set to null.
24. **Badges.** Beat the Crowd uses the crowd snapshot taken at lock and is awarded once per question. The season
    category title goes to the top `ceil(1%)` (at least 1) of users with positive points in that category, when the
    season ends.
25. **Streak shields.** A shield covers exactly one missed day. At most 1 shield is used per Riyadh week, counted in
    the week of the missed day.

## Technical

26. **Versions.** Next.js 15.5 (stable App Router), React 19, NestJS 11, Prisma 6.19, Tailwind 4, Vitest 3,
    Playwright 1.63 (matches the browser in the dev image), BullMQ 5, Socket.IO 4.
27. **i18n.** A small in-house dictionary loader (`apps/web/messages/{ar,en}.json`) is used instead of a library. The
    locale comes from a cookie, so URLs have no locale prefix. `<html lang dir>` is set on the server.
28. **Number and date formatting.** Use `ar-SA-u-nu-latn-ca-gregory`. Plain `ar-SA` would render Arabic-Indic digits
    and the Hijri calendar.
29. **Forecast queue.** `POST /forecasts` validates synchronously (including lock time), then enqueues. It waits up
    to 3s for the job and returns 200, or 202 if the job is still queued. The worker re-checks against the
    *submission* time. If a question locked while pre-lock jobs were still draining, the worker refreshes the crowd
    snapshot.
30. **Locking.** A delayed BullMQ job runs at lockAt, and a sweeper runs every 15s as a safety net. Forecast
    acceptance never depends on the job: it compares server time with `lockAt`.
31. **Test routes.** `/api/test/*` (clock offset, run sweepers, read the last OTP) exist only when
    `ENABLE_TEST_ROUTES=true`. Both the module and the clock offset are disabled when `NODE_ENV=production`.
32. **Future Sponsor/Prize.** No tables are built. Extension points: `Question.meta Json?` (for future attribution),
    `BadgeAward.meta`, and the scoring pipeline's `onQuestionScored` hook list in `ScoringService`. Prize logic in
    later phases must subscribe to those, never modify `Score`.
33. **Crowd after lock.** The crowd split is hidden from users who have not forecast while a question is LIVE. Once it
    locks, the final snapshot is shown to everyone, because it can no longer influence anyone's forecast.
34. **Bidi.** Every interpolated value in UI strings is wrapped in Unicode isolates (LRI/FSI…PDI), so "+58" or "90%"
    keep their order inside Arabic sentences.
35. **API container base image.** The API image is built on the official Playwright image (`mcr.microsoft.com/playwright:v1.63.0-noble`), which bundles Node and a pinned Chromium for share cards, so builds need no OS package mirrors. It is overridable with `--build-arg BASE_IMAGE=...`. A slimmer production image can use a distro Chromium (set `CHROMIUM_PATH`).
36. **Optional build-time CA and proxy.** Both Dockerfiles accept `--secret id=ca` and the standard proxy build args, for TLS-intercepting corporate networks. They do nothing when these are not supplied.
37. **Test-only user creation.** `/api/test/users` creates onboarded users without OTP (e2e supporting actors), so the OTP limits stay realistic. Like every test route, it is absent unless `ENABLE_TEST_ROUTES=true` and `NODE_ENV` is not production.
38. **Disputes.** Only users who forecast on a question may report its result, one report per user.
39. **Widget design (owner request, 2026-11-07).** The UI uses a widget/card layout approved from a mockup: mint-grey canvas, white rounded cards, emerald primary with amber and blue accents, a floating dark bottom bar. The home page shows summary widgets (season points with a daily chart for the week, streak, accuracy ring, league position, challenge rating, friend league). Tapping an answer on a feed card opens the question with that answer preselected; confidence is always chosen explicitly. `/me/summary` gained `stats.weekDaily` (points per Riyadh day of the current week).
