import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

describe('PDPL', () => {
  it('exports all personal data, including the decrypted phone number, only to the owner', async () => {
    const u = await makeUser(ctx, { nickname: 'exporter' });
    const q = await makeLiveQuestion(ctx);
    await ctx.http().post('/api/forecasts').set(u.auth).send({ questionId: q.id, optionId: 'opt0', confidence: 60 }).expect(200);
    const res = await ctx.http().get('/api/me/export').set(u.auth).expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.account).toMatchObject({ nickname: 'exporter', phone: u.phone, city: 'riyadh' });
    expect(res.body.forecasts).toHaveLength(1);
    expect(res.body.forecastHistory).toHaveLength(1);
    await ctx.http().get('/api/me/export').expect(401);
  });

  it('deletes the account and everything owned by it, including leaderboard entries and live crowd counts', async () => {
    const editor = await makeUser(ctx, { role: 'EDITOR' });
    const reviewer = await makeUser(ctx, { role: 'REVIEWER' });
    const u = await makeUser(ctx, { nickname: 'leaver' });
    const other = await makeUser(ctx);
    const q1 = await makeLiveQuestion(ctx);
    const q2 = await makeLiveQuestion(ctx, { lockInMs: 10 * 3600_000 });
    await ctx.http().post('/api/forecasts').set(u.auth).send({ questionId: q1.id, optionId: 'opt0', confidence: 90 }).expect(200);
    await resolveViaApi(ctx, q1.id, 'opt0', editor.auth, reviewer.auth);
    await ctx.http().post('/api/forecasts').set(u.auth).send({ questionId: q2.id, optionId: 'opt1', confidence: 60 }).expect(200);
    await ctx.http().post('/api/forecasts').set(other.auth).send({ questionId: q2.id, optionId: 'opt1', confidence: 60 }).expect(200);
    const fl = await ctx.http().post('/api/friend-leagues').set(u.auth).send({ name: 'Mine' }).expect(201);
    const dq = await makeLiveQuestion(ctx);
    await ctx.http().post('/api/duels').set(u.auth).send({ format: 'SINGLE', questionId: dq.id, optionId: 'opt0' }).expect(201);
    expect((await ctx.http().get('/api/leaderboards/week').expect(200)).body.rows).toHaveLength(1);

    await ctx.http().delete('/api/me').set(u.auth).send({ confirmNickname: 'wrong' }).expect(400);
    await ctx.http().delete('/api/me').set(u.auth).send({ confirmNickname: 'leaver' }).expect(200);

    expect(await ctx.prisma.user.findUnique({ where: { id: u.user.id } })).toBeNull();
    for (const model of ['forecast', 'forecastHistory', 'score', 'leagueMembership', 'streak', 'duel'] as const) {
      // @ts-expect-error dynamic model access
      expect(await ctx.prisma[model].count({ where: model === 'duel' ? { challengerId: u.user.id } : { userId: u.user.id } })).toBe(0);
    }
    expect(await ctx.prisma.friendLeague.findUnique({ where: { id: fl.body.id } })).toBeNull();
    expect((await ctx.http().get('/api/leaderboards/week').expect(200)).body.rows).toHaveLength(0);
    expect(await ctx.redis.client.hget(`crowd:${q2.id}`, 'opt1')).toBe('1');
    // the session no longer works
    await ctx.http().get('/api/me').set(u.auth).expect(401);
    // audit rows written by staff are untouched
    expect(await ctx.prisma.auditLog.count()).toBeGreaterThan(0);
  });
});
