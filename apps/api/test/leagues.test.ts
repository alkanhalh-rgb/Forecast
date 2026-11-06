import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { weekStart, WEEK_MS } from '@app/shared';
import { LeaguesService } from '../src/leagues/leagues.service';
import { createTestApp, makeLiveQuestion, makeUser, resetState, resolveViaApi, seedCategories, TestCtx } from './helpers';

let ctx: TestCtx;
let leagues: LeaguesService;
beforeAll(async () => {
  ctx = await createTestApp();
  leagues = ctx.app.get(LeaguesService);
});
afterAll(() => ctx.app.close());
beforeEach(async () => {
  await resetState(ctx);
  await seedCategories(ctx);
});

const fc = (auth: Record<string, string>, questionId: string, optionId: string, confidence = 75) =>
  ctx.http().post('/api/forecasts').set(auth).send({ questionId, optionId, confidence }).expect(200);

describe('weekly league groups', () => {
  it('a first forecast joins a group; groups hold 30 users', async () => {
    const q = await makeLiveQuestion(ctx);
    const users = [];
    for (let i = 0; i < 31; i++) users.push(await makeUser(ctx));
    for (const u of users) await fc(u.auth, q.id, 'opt0');
    const groups = await ctx.prisma.leagueGroup.findMany({ include: { _count: { select: { memberships: true } } }, orderBy: { index: 'asc' } });
    expect(groups.map((g) => [g.division, g._count.memberships])).toEqual([
      [1, 30],
      [1, 1],
    ]);
    const me = await ctx.http().get('/api/leagues/me').set(users[0]!.auth).expect(200);
    expect(me.body).toMatchObject({ joined: true, division: 1 });
    expect(me.body.members).toHaveLength(30);
    expect(JSON.stringify(me.body)).not.toMatch(/phone|\+966/);
  });

  it('Sunday 00:00 Riyadh rollover: top 5 up, bottom 5 down, and next week uses the new division', async () => {
    const now = ctx.clock.now();
    const ws = weekStart(now);
    const prevWs = new Date(ws.getTime() - WEEK_MS);
    const users = [];
    for (let i = 0; i < 30; i++) users.push(await makeUser(ctx));
    // last week everyone stayed in division 3
    const pw = await ctx.prisma.leagueWeek.create({ data: { weekStart: prevWs, closedAt: now } });
    const pg = await ctx.prisma.leagueGroup.create({ data: { weekId: pw.id, weekStart: prevWs, division: 3, index: 0 } });
    for (const u of users) await ctx.prisma.leagueMembership.create({ data: { userId: u.user.id, weekStart: prevWs, division: 3, groupId: pg.id, movement: 'STAY', finalRank: 1 } });
    // this week they join division 3 and earn distinct points
    for (let i = 0; i < 30; i++) {
      const m = await leagues.join(users[i]!.user.id, new Date(now.getTime() + i));
      expect(m.division).toBe(3);
      await ctx.prisma.leagueMembership.update({ where: { id: m.id }, data: { weeklyPoints: 300 - i * 10 } });
    }
    expect(await leagues.rolloverDue()).toEqual({ closed: 0 }); // week not over yet
    ctx.clock.setOffset(ws.getTime() + WEEK_MS - Date.now()); // next Sunday 00:00 Riyadh
    expect(await leagues.rolloverDue()).toEqual({ closed: 1 });
    const ms = await ctx.prisma.leagueMembership.findMany({ where: { weekStart: ws }, orderBy: { finalRank: 'asc' } });
    expect(ms.slice(0, 5).every((m) => m.movement === 'UP')).toBe(true);
    expect(ms.slice(25).every((m) => m.movement === 'DOWN')).toBe(true);
    expect(ms.slice(5, 25).every((m) => m.movement === 'STAY')).toBe(true);
    expect(ms[0]!.userId).toBe(users[0]!.user.id);
    // next week divisions
    const top = await leagues.join(users[0]!.user.id, ctx.clock.now());
    const mid = await leagues.join(users[10]!.user.id, ctx.clock.now());
    const bottom = await leagues.join(users[29]!.user.id, ctx.clock.now());
    expect([top.division, mid.division, bottom.division]).toEqual([4, 3, 2]);
    const me = await ctx.http().get('/api/leagues/me').set(users[0]!.auth).expect(200);
    expect(me.body.lastWeek).toEqual({ rank: 1, movement: 'UP', division: 3 });
  });
});

describe('leaderboards (Redis sorted sets)', () => {
  it('week, season, category and friends boards follow scoring, corrections and voids', async () => {
    const editor = await makeUser(ctx, { role: 'EDITOR' });
    const reviewer = await makeUser(ctx, { role: 'REVIEWER' });
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const a = await makeUser(ctx, { nickname: 'alpha' });
    const b = await makeUser(ctx, { nickname: 'bravo' });
    const c = await makeUser(ctx, { nickname: 'charlie' });
    const q1 = await makeLiveQuestion(ctx, { categorySlug: 'oil' });
    const q2 = await makeLiveQuestion(ctx, { categorySlug: 'spl' });
    await fc(a.auth, q1.id, 'opt0', 90);
    await fc(b.auth, q1.id, 'opt0', 60);
    await fc(c.auth, q1.id, 'opt1', 75);
    await fc(c.auth, q2.id, 'opt0', 90);
    await resolveViaApi(ctx, q1.id, 'opt0', editor.auth, reviewer.auth); // a +85, b +26, c -100
    await resolveViaApi(ctx, q2.id, 'opt0', editor.auth, reviewer.auth); // c +85

    const week = await ctx.http().get('/api/leaderboards/week').set(b.auth).expect(200);
    expect(week.body.rows.map((r: { nickname: string; points: number }) => [r.nickname, r.points])).toEqual([
      ['alpha', 85],
      ['bravo', 26],
      ['charlie', -15],
    ]);
    expect(week.body.mine).toMatchObject({ rank: 2, nickname: 'bravo', me: true });
    expect(JSON.stringify(week.body)).not.toMatch(/phone|\+966/);
    const season = await ctx.http().get('/api/leaderboards/season').expect(200);
    expect(season.body.rows[0]).toMatchObject({ nickname: 'alpha', points: 85 });
    const spl = await ctx.http().get('/api/leaderboards/category/spl').expect(200);
    expect(spl.body.rows.map((r: { nickname: string }) => r.nickname)).toEqual(['charlie']);

    // correction flips q1: a -232, b -32, c +58
    ctx.clock.advance(13 * 3600_000);
    await ctx.http().post(`/api/admin/questions/${q1.id}/correct`).set(admin.auth).send({ winningOptionId: 'opt1', sourceUrl: 'https://x.sa/c', correctionNote: 'Official figure revised.' }).expect(200);
    const after = await ctx.http().get('/api/leaderboards/season').expect(200);
    expect(after.body.rows.map((r: { nickname: string; points: number }) => [r.nickname, r.points])).toEqual([
      ['charlie', 143],
      ['bravo', -32],
      ['alpha', -232],
    ]);
    // weekly league points follow too
    const ma = await ctx.prisma.leagueMembership.findFirstOrThrow({ where: { userId: a.user.id } });
    expect(ma.weeklyPoints).toBe(-232);

    // void q2 removes c's +85
    await ctx.http().post(`/api/admin/questions/${q2.id}/void`).set(admin.auth).send({ reason: 'ABANDONED' }).expect(200);
    const afterVoid = await ctx.http().get('/api/leaderboards/season').expect(200);
    expect(afterVoid.body.rows[0]).toMatchObject({ nickname: 'charlie', points: 58 });

    // rebuild from DB gives the same result
    await leagues.rebuildLeaderboards();
    const rebuilt = await ctx.http().get('/api/leaderboards/season').expect(200);
    expect(rebuilt.body.rows).toEqual(afterVoid.body.rows);
  });

  it('friends board ranks people who share a friend league', async () => {
    const a = await makeUser(ctx, { nickname: 'amal' });
    const b = await makeUser(ctx, { nickname: 'badr' });
    await makeUser(ctx, { nickname: 'stranger' });
    const fl = await ctx.prisma.friendLeague.create({ data: { name: 'Office', inviteCode: 'ABCDEFGH', ownerId: a.user.id } });
    await ctx.prisma.friendLeagueMember.createMany({ data: [{ leagueId: fl.id, userId: a.user.id }, { leagueId: fl.id, userId: b.user.id }] });
    const res = await ctx.http().get('/api/leaderboards/friends').set(a.auth).expect(200);
    expect(res.body.rows.map((r: { nickname: string }) => r.nickname).sort()).toEqual(['amal', 'badr']);
  });
});
