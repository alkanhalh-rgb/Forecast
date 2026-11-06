import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ForecastsService } from '../src/forecasts/forecasts.service';
import { LifecycleService } from '../src/questions/lifecycle.service';
import { createTestApp, makeLiveQuestion, makeUser, resetState, seedCategories, TestCtx } from './helpers';

let ctx: TestCtx;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.app.close());
beforeEach(async () => {
  await resetState(ctx);
  await seedCategories(ctx);
});

const forecast = (auth: Record<string, string>, questionId: string, optionId = 'opt0', confidence = 75) => ctx.http().post('/api/forecasts').set(auth).send({ questionId, optionId, confidence });

describe('server-side lock enforcement', () => {
  it('accepts before lockAt and rejects after lockAt even while the status is still LIVE', async () => {
    const { auth } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx, { lockInMs: 60_000 });
    await forecast(auth, q.id).expect(200);
    ctx.clock.advance(60_000); // exactly lockAt
    const res = await forecast(auth, q.id, 'opt1').expect(409);
    expect(res.body.error.code).toBe('QUESTION_LOCKED');
    expect((await ctx.prisma.question.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('LIVE');
    const f = await ctx.prisma.forecast.findFirstOrThrow({ where: { questionId: q.id } });
    expect(f.optionId).toBe('opt0'); // unchanged
  });

  it('rejects once the lock job has run', async () => {
    const { auth } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx, { lockInMs: 1000 });
    ctx.clock.advance(1000);
    await ctx.app.get(LifecycleService).lockDue();
    expect((await ctx.prisma.question.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('LOCKED');
    expect((await forecast(auth, q.id).expect(409)).body.error.code).toBe('QUESTION_LOCKED');
  });

  it('the worker rejects a job submitted at/after lockAt, but accepts a pre-lock job processed late', async () => {
    const { user } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx, { lockInMs: 5000 });
    const svc = ctx.app.get(ForecastsService);
    const late = await svc.apply({ userId: user.id, questionId: q.id, optionId: 'opt0', confidence: 60, submittedAt: q.lockAt.toISOString() });
    expect(late).toEqual({ ok: false, code: 'QUESTION_LOCKED' });
    ctx.clock.advance(6000);
    await ctx.app.get(LifecycleService).lockDue();
    const early = await svc.apply({ userId: user.id, questionId: q.id, optionId: 'opt1', confidence: 60, submittedAt: new Date(q.lockAt.getTime() - 1).toISOString() });
    expect(early.ok).toBe(true);
    const snap = (await ctx.prisma.question.findUniqueOrThrow({ where: { id: q.id } })).crowdSnapshot as { total: number };
    expect(snap.total).toBe(1);
  });

  it('rejects forecasts on DRAFT questions and invalid options/confidence', async () => {
    const { auth } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await ctx.prisma.question.update({ where: { id: q.id }, data: { status: 'DRAFT' } });
    expect((await forecast(auth, q.id).expect(409)).body.error.code).toBe('QUESTION_NOT_LIVE');
    const q2 = await makeLiveQuestion(ctx);
    expect((await forecast(auth, q2.id, 'nope').expect(400)).body.error.code).toBe('INVALID_OPTION');
    await forecast(auth, q2.id, 'opt0', 50).expect(400);
  });
});

describe('forecasting', () => {
  it('a user can change their forecast until lock; the last one counts; history is kept', async () => {
    const { auth, user } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await forecast(auth, q.id, 'opt0', 60).expect(200);
    ctx.clock.advance(1000);
    const res = await forecast(auth, q.id, 'opt1', 90).expect(200);
    expect(res.body.forecast).toMatchObject({ optionId: 'opt1', confidence: 90 });
    expect(await ctx.prisma.forecast.count({ where: { userId: user.id } })).toBe(1);
    expect(await ctx.prisma.forecastHistory.count({ where: { userId: user.id } })).toBe(2);
    expect(res.body.crowd).toEqual({ total: 1, shares: { opt0: 0, opt1: 1 } });
  });

  it('an older submission processed after a newer one does not overwrite it', async () => {
    const { user } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    const svc = ctx.app.get(ForecastsService);
    const t = ctx.clock.now().getTime();
    await svc.apply({ userId: user.id, questionId: q.id, optionId: 'opt1', confidence: 90, submittedAt: new Date(t + 2000).toISOString() });
    await svc.apply({ userId: user.id, questionId: q.id, optionId: 'opt0', confidence: 60, submittedAt: new Date(t + 1000).toISOString() });
    const f = await ctx.prisma.forecast.findFirstOrThrow();
    expect(f.optionId).toBe('opt1');
  });

  it('crowd % is hidden until the user has answered and comes from Redis counters', async () => {
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    const c = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await forecast(a.auth, q.id, 'opt0').expect(200);
    await forecast(b.auth, q.id, 'opt0').expect(200);
    const hidden = await ctx.http().get(`/api/questions/${q.id}`).set(c.auth).expect(200);
    expect(hidden.body.crowd).toBeNull();
    expect(hidden.body.forecasters).toBe(2);
    await forecast(c.auth, q.id, 'opt1').expect(200);
    const shown = await ctx.http().get(`/api/questions/${q.id}`).set(c.auth).expect(200);
    expect(shown.body.crowd.total).toBe(3);
    expect(shown.body.crowd.shares.opt0).toBeCloseTo(2 / 3);
    expect(await ctx.redis.client.hget(`crowd:${q.id}`, 'opt0')).toBe('2');
    const anon = await ctx.http().get(`/api/questions/${q.id}`).expect(200);
    expect(anon.body.crowd).toBeNull();
  });

  it('feed lists LIVE questions soonest lock first, filtered by category', async () => {
    const { auth } = await makeUser(ctx);
    const later = await makeLiveQuestion(ctx, { lockInMs: 7200_000 });
    const sooner = await makeLiveQuestion(ctx, { lockInMs: 600_000, categorySlug: 'oil' });
    await makeLiveQuestion(ctx, { status: 'LOCKED' });
    const res = await ctx.http().get('/api/questions').set(auth).expect(200);
    expect(res.body.map((q: { id: string }) => q.id)).toEqual([sooner.id, later.id]);
    const oil = await ctx.http().get('/api/questions?category=oil').expect(200);
    expect(oil.body.map((q: { id: string }) => q.id)).toEqual([sooner.id]);
  });

  it('forecast creation is rate limited', async () => {
    const { auth } = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    for (let i = 0; i < 30; i++) await forecast(auth, q.id, i % 2 ? 'opt0' : 'opt1');
    expect((await forecast(auth, q.id).expect(429)).body.error.code).toBe('RATE_LIMITED');
  });

  it('users who have not confirmed 18+ cannot forecast', async () => {
    const { auth } = await makeUser(ctx, { onboarded: false });
    const q = await makeLiveQuestion(ctx);
    expect((await forecast(auth, q.id).expect(403)).body.error.code).toBe('ONBOARDING_REQUIRED');
  });
});

describe('admin create → review → publish', () => {
  const ATTEST = { lockBeforeOutcomePublic: true, notBlockedTopic: true, neutralWording: true, optionsExclusiveExhaustive: true };
  let weatherId = '';
  beforeEach(async () => {
    weatherId = (await ctx.prisma.category.findUniqueOrThrow({ where: { slug: 'weather' } })).id;
  });
  function draft(auth: Record<string, string>, overrides: Record<string, unknown> = {}) {
    const now = ctx.clock.now().getTime();
    return ctx
      .http()
      .post('/api/admin/questions')
      .set(auth)
      .send({
        categoryId: weatherId,
        textAr: 'هل ستتجاوز الحرارة العظمى في الرياض 35 درجة اليوم؟',
        textEn: 'Will Riyadh max temperature exceed 35°C today?',
        options: [
          { labelAr: 'نعم', labelEn: 'Yes' },
          { labelAr: 'لا', labelEn: 'No' },
        ],
        lockAt: new Date(now + 3600_000).toISOString(),
        resolveBy: new Date(now + 10 * 3600_000).toISOString(),
        sourceName: 'National Center for Meteorology',
        sourceUrl: 'https://ncm.gov.sa/',
        ...overrides,
      });
  }

  it('full flow with checklist, separate reviewer and audit log', async () => {
    const editor = await makeUser(ctx, { role: 'EDITOR' });
    const reviewer = await makeUser(ctx, { role: 'REVIEWER' });
    const user = await makeUser(ctx);
    await draft(user.auth).expect(403);
    const d = await draft(editor.auth).expect(201);
    expect(d.body.status).toBe('DRAFT');
    // checklist must be complete
    const incomplete = await ctx.http().post(`/api/admin/questions/${d.body.id}/submit`).set(editor.auth).send({ ...ATTEST, neutralWording: false }).expect(422);
    expect(incomplete.body.error.code).toBe('CHECKLIST_INCOMPLETE');
    await ctx.http().post(`/api/admin/questions/${d.body.id}/submit`).set(editor.auth).send(ATTEST).expect(200);
    // editors cannot approve; draft is not visible publicly
    await ctx.http().post(`/api/admin/questions/${d.body.id}/approve`).set(editor.auth).send(ATTEST).expect(403);
    await ctx.http().get(`/api/questions/${d.body.id}`).expect(404);
    const pub = await ctx.http().post(`/api/admin/questions/${d.body.id}/approve`).set(reviewer.auth).send(ATTEST).expect(200);
    expect(pub.body).toMatchObject({ status: 'LIVE', reviewedById: reviewer.user.id });
    const feed = await ctx.http().get('/api/questions').expect(200);
    expect(feed.body).toHaveLength(1);
    const actions = (await ctx.prisma.auditLog.findMany({ where: { entityId: d.body.id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['question.create', 'question.submit', 'question.publish']);
  });

  it('the reviewer must be a different person from the creator (even an admin)', async () => {
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const d = await draft(admin.auth).expect(201);
    await ctx.http().post(`/api/admin/questions/${d.body.id}/submit`).set(admin.auth).send(ATTEST).expect(200);
    const res = await ctx.http().post(`/api/admin/questions/${d.body.id}/approve`).set(admin.auth).send(ATTEST).expect(403);
    expect(res.body.error.code).toBe('SAME_PERSON');
  });

  it('blocks publishing when it would resolve more than 24h after publish, has banned words or a blocked topic', async () => {
    const editor = await makeUser(ctx, { role: 'EDITOR' });
    const now = ctx.clock.now().getTime();
    const far = await draft(editor.auth, { resolveBy: new Date(now + 30 * 3600_000).toISOString() }).expect(201);
    const r1 = await ctx.http().post(`/api/admin/questions/${far.body.id}/submit`).set(editor.auth).send(ATTEST).expect(422);
    expect(r1.body.error.auto.resolvesWithin24h).toBe(false);
    const words = await draft(editor.auth, { textEn: 'What are the odds Riyadh passes 35°C today?' }).expect(201);
    const r2 = await ctx.http().post(`/api/admin/questions/${words.body.id}/submit`).set(editor.auth).send(ATTEST).expect(422);
    expect(r2.body.error.auto.noBannedWords).toBe(false);
    const topic = await draft(editor.auth, { textEn: 'Will the minister announce new rules today?' }).expect(201);
    const r3 = await ctx.http().post(`/api/admin/questions/${topic.body.id}/submit`).set(editor.auth).send(ATTEST).expect(422);
    expect(r3.body.error.auto.noBlockedKeywords).toBe(false);
  });

  it('the 24h rule is re-checked at publish time', async () => {
    const editor = await makeUser(ctx, { role: 'EDITOR' });
    const reviewer = await makeUser(ctx, { role: 'REVIEWER' });
    const now = ctx.clock.now().getTime();
    const d = await draft(editor.auth, { lockAt: new Date(now + 20 * 3600_000).toISOString(), resolveBy: new Date(now + 23 * 3600_000).toISOString() }).expect(201);
    await ctx.http().post(`/api/admin/questions/${d.body.id}/submit`).set(editor.auth).send(ATTEST).expect(200);
    ctx.clock.advance(-2 * 3600_000); // reviewer approves "earlier" than the editor => > 24h before resolve
    const r = await ctx.http().post(`/api/admin/questions/${d.body.id}/approve`).set(reviewer.auth).send(ATTEST).expect(422);
    expect(r.body.error.auto.resolvesWithin24h).toBe(false);
  });

  it('creates drafts from recurring templates', async () => {
    const editor = await makeUser(ctx, { role: 'EDITOR' });
    const t = await ctx.http().get('/api/admin/templates').set(editor.auth).expect(200);
    expect(t.body.map((x: { key: string }) => x.key)).toEqual(['TASI_DAILY_CLOSE', 'BRENT_DAILY_SETTLE', 'RIYADH_WEATHER_TOMORROW', 'SPL_MATCH']);
    const d = await ctx.http().post('/api/admin/templates/SPL_MATCH').set(editor.auth).send({ params: { homeAr: 'الهلال', homeEn: 'Al Hilal', awayAr: 'النصر', awayEn: 'Al Nassr', kickoff: '2026-11-08T17:00:00Z' } }).expect(201);
    expect(d.body).toMatchObject({ status: 'DRAFT', templateKey: 'SPL_MATCH' });
    expect(d.body.options).toHaveLength(3);
  });
});
