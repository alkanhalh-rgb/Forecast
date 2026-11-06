import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { riyadhTime } from '@app/shared';
import { AchievementsService } from '../src/social/achievements.service';
import { NotificationsService } from '../src/social/notifications.service';
import { ShareCardsService } from '../src/social/share-cards.service';
import { createTestApp, makeLiveQuestion, makeUser, resetState, resolveViaApi, seedCategories, TestCtx } from './helpers';

let ctx: TestCtx;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.app.close());
beforeEach(async () => {
  await resetState(ctx);
  await seedCategories(ctx);
});

type Auth = Record<string, string>;
const fc = (auth: Auth, questionId: string, optionId: string, confidence = 75) => ctx.http().post('/api/forecasts').set(auth).send({ questionId, optionId, confidence }).expect(200);
/** Puts the test clock at a given Riyadh wall-clock time. */
const setRiyadh = (day: string, h: number, m = 0) => ctx.clock.setOffset(riyadhTime(day, h, m).getTime() - Date.now());
const staff = async () => ({ editor: await makeUser(ctx, { role: 'EDITOR' }), reviewer: await makeUser(ctx, { role: 'REVIEWER' }) });

describe('friend leagues', () => {
  it('create, share invite code, join (max 50), weekly ranking', async () => {
    const owner = await makeUser(ctx, { nickname: 'owner' });
    const l = await ctx.http().post('/api/friend-leagues').set(owner.auth).send({ name: 'الشلة' }).expect(201);
    expect(l.body.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    const preview = await ctx.http().get(`/api/friend-leagues/code/${l.body.inviteCode}`).expect(200);
    expect(preview.body).toMatchObject({ name: 'الشلة', members: 1, full: false });
    for (let i = 0; i < 49; i++) {
      const u = await makeUser(ctx);
      await ctx.http().post('/api/friend-leagues/join').set(u.auth).send({ code: l.body.inviteCode.toLowerCase() }).expect(200);
    }
    const late = await makeUser(ctx);
    expect((await ctx.http().post('/api/friend-leagues/join').set(late.auth).send({ code: l.body.inviteCode }).expect(409)).body.error.code).toBe('LEAGUE_FULL');
    await ctx.http().get(`/api/friend-leagues/${l.body.id}`).set(late.auth).expect(403);
    const d = await ctx.http().get(`/api/friend-leagues/${l.body.id}`).set(owner.auth).expect(200);
    expect(d.body.members).toBe(50);
    expect(d.body.rows).toHaveLength(50);
    expect(d.body.mine.nickname).toBe('owner');
  });
});

describe('streaks', () => {
  it('counts Riyadh days with a forecast and applies one free shield per week automatically', async () => {
    const u = await makeUser(ctx);
    const forecastOn = async (day: string, h = 12) => {
      setRiyadh(day, h);
      const q = await makeLiveQuestion(ctx);
      await fc(u.auth, q.id, 'opt0');
    };
    await forecastOn('2026-11-01'); // Sunday
    await forecastOn('2026-11-01', 23); // same day
    await forecastOn('2026-11-02');
    await forecastOn('2026-11-04'); // missed Tue -> shield
    let s = (await ctx.http().get('/api/me/summary').set(u.auth).expect(200)).body.streak;
    expect(s).toEqual({ current: 3, best: 3, shieldAvailable: false }); // the shield keeps the streak alive across the missed day
    await forecastOn('2026-11-06'); // missed Thu, shield already used this week -> reset
    s = (await ctx.http().get('/api/me/summary').set(u.auth).expect(200)).body.streak;
    expect(s).toMatchObject({ current: 1, best: 3 });
    // a forecast at 23:30 Riyadh counts for that Riyadh day (not the UTC day)
    await forecastOn('2026-11-07', 23);
    expect((await ctx.prisma.streak.findUniqueOrThrow({ where: { userId: u.user.id } })).lastActiveDay).toBe('2026-11-07');
  });
});

describe('badges and share cards', () => {
  it('Beat the Crowd: correct with under 30% of >= 20 forecasters; a share card is generated', async () => {
    const { editor, reviewer } = await staff();
    const q = await makeLiveQuestion(ctx);
    const users = [];
    for (let i = 0; i < 20; i++) users.push(await makeUser(ctx));
    for (let i = 0; i < 20; i++) await fc(users[i]!.auth, q.id, i < 5 ? 'opt1' : 'opt0'); // 25% picked opt1
    await resolveViaApi(ctx, q.id, 'opt1', editor.auth, reviewer.auth);
    const awards = await ctx.prisma.badgeAward.findMany({ where: { badge: 'BEAT_THE_CROWD' } });
    expect(awards).toHaveLength(5);
    const cards = await ctx.prisma.shareCard.findMany({ where: { kind: 'BEAT_THE_CROWD' } });
    expect(cards).toHaveLength(5);
    const png = await ctx.http().get(`/api/share/${cards[0]!.id}.png`).expect(200);
    expect(png.headers['content-type']).toBe('image/png');
    expect(Buffer.from(png.body).subarray(1, 4).toString()).toBe('PNG');
  });

  it('Calibrated: 30+ forecasts at 75% with a 65-85% hit rate', async () => {
    const { editor, reviewer } = await staff();
    const u = await makeUser(ctx);
    for (let i = 0; i < 30; i++) {
      const q = await makeLiveQuestion(ctx, { lockInMs: 60_000 });
      await fc(u.auth, q.id, 'opt0', 75);
      await resolveViaApi(ctx, q.id, i < 22 ? 'opt0' : 'opt1', editor.auth, reviewer.auth); // 22/30 = 73%
      if (i === 28) expect(await ctx.prisma.badgeAward.count({ where: { badge: 'CALIBRATED' } })).toBe(0);
    }
    expect(await ctx.prisma.badgeAward.count({ where: { userId: u.user.id, badge: 'CALIBRATED' } })).toBe(1);
  });

  it('duel win: first-win badge, share card, and notifications to both players', async () => {
    const { editor, reviewer } = await staff();
    const a = await makeUser(ctx, { nickname: 'winner' });
    const b = await makeUser(ctx, { nickname: 'loser' });
    setRiyadh('2026-11-05', 12);
    const q = await makeLiveQuestion(ctx);
    const d = await ctx.http().post('/api/duels').set(a.auth).send({ format: 'SINGLE', questionId: q.id, optionId: 'opt0', opponentNickname: 'loser' }).expect(201);
    expect(await ctx.prisma.notification.count({ where: { userId: b.user.id, kind: 'DUEL_CHALLENGE' } })).toBe(1);
    await ctx.http().post(`/api/duels/${d.body.id}/accept`).set(b.auth).send({ optionId: 'opt1' }).expect(200);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    expect(await ctx.prisma.badgeAward.findMany({ where: { userId: a.user.id } })).toMatchObject([{ badge: 'DUEL_WIN_1' }]);
    expect(await ctx.prisma.shareCard.count({ where: { userId: a.user.id, kind: 'DUEL_WIN' } })).toBe(1);
    expect(await ctx.prisma.notification.count({ where: { kind: 'DUEL_RESULT' } })).toBe(2);
    const summary = await ctx.http().get('/api/me/summary').set(a.auth).expect(200);
    expect(summary.body.shareCards).toHaveLength(1);
    expect(summary.body.duelRating.wins).toBe(1);
  });

  it('season category title goes to the top 1% when the season closes', async () => {
    const { editor, reviewer } = await staff();
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx, { categorySlug: 'weather' });
    await fc(a.auth, q.id, 'opt0', 90);
    await fc(b.auth, q.id, 'opt0', 60);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    const season = await ctx.prisma.season.findFirstOrThrow();
    ctx.clock.setOffset(season.endsAt.getTime() - Date.now() + 1000);
    expect(await ctx.app.get(AchievementsService).closeDueSeasons()).toEqual({ closed: 1 });
    const titles = await ctx.prisma.badgeAward.findMany({ where: { badge: 'SEASON_CATEGORY_TITLE' } });
    expect(titles.map((t) => t.userId)).toEqual([a.user.id]);
  });

  it('share cards render Arabic with the embedded font and correct letter joining', async () => {
    const r = await ctx.app.get(ShareCardsService).shapingCheck();
    expect(r.fontLoaded).toBe(true);
    // joined forms are narrower than the same letters forced apart: shaping is active
    expect(Math.abs(r.joinedWidth - r.isolatedWidth)).toBeGreaterThan(5);
  });
});

describe('notifications and quiet hours (23:00-07:00 Riyadh)', () => {
  it('a resolution at 23:30 is queued until 07:00, then delivered', async () => {
    const { editor, reviewer } = await staff();
    const u = await makeUser(ctx);
    setRiyadh('2026-11-05', 20);
    const q = await makeLiveQuestion(ctx, { lockInMs: 3600_000 });
    await fc(u.auth, q.id, 'opt0');
    setRiyadh('2026-11-05', 23, 30);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    const n = await ctx.prisma.notification.findFirstOrThrow({ where: { userId: u.user.id, kind: 'RESOLUTION' } });
    expect(n.deliverAt.toISOString()).toBe(riyadhTime('2026-11-06', 7).toISOString());
    expect(n.sentAt).toBeNull();
    expect((await ctx.http().get('/api/notifications').set(u.auth).expect(200)).body).toHaveLength(0);
    const svc = ctx.app.get(NotificationsService);
    setRiyadh('2026-11-06', 6, 59);
    expect(await svc.sendDue()).toMatchObject({ sent: 0 });
    setRiyadh('2026-11-06', 7, 0);
    expect(await svc.sendDue()).toEqual({ sent: 1 });
    const inbox = (await ctx.http().get('/api/notifications').set(u.auth).expect(200)).body;
    expect(inbox).toHaveLength(1);
    expect(inbox[0].params.points).toBe(58);
  });

  it('daytime notifications are delivered immediately; voids notify everyone who answered; dispute decisions notify the reporter', async () => {
    const { editor, reviewer } = await staff();
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    setRiyadh('2026-11-05', 10);
    const q = await makeLiveQuestion(ctx);
    await fc(a.auth, q.id, 'opt0');
    await fc(b.auth, q.id, 'opt1');
    await ctx.http().post(`/api/admin/questions/${q.id}/void`).set(editor.auth).send({ reason: 'POSTPONED' }).expect(200);
    const voids = await ctx.prisma.notification.findMany({ where: { kind: 'VOID' } });
    expect(voids.map((v) => v.userId).sort()).toEqual([a.user.id, b.user.id].sort());
    expect(voids.every((v) => v.sentAt !== null)).toBe(true);

    const q2 = await makeLiveQuestion(ctx);
    await fc(a.auth, q2.id, 'opt1');
    await resolveViaApi(ctx, q2.id, 'opt0', editor.auth, reviewer.auth);
    const rep = await ctx.http().post(`/api/questions/${q2.id}/disputes`).set(a.auth).send({ evidenceUrl: 'https://example.com/e', message: 'Wrong outcome reported.' }).expect(201);
    await ctx.http().post(`/api/admin/disputes/${rep.body.id}/decide`).set(admin.auth).send({ decision: 'REJECTED', note: 'Checked the source.' }).expect(200);
    expect(await ctx.prisma.notification.count({ where: { userId: a.user.id, kind: 'DISPUTE_DECISION' } })).toBe(1);
  });
});
