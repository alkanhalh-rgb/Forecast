import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ResolutionService } from '../src/scoring/resolution.service';
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

const H = 3600_000;
const fc = (auth: Record<string, string>, questionId: string, optionId: string, confidence: number) =>
  ctx.http().post('/api/forecasts').set(auth).send({ questionId, optionId, confidence }).expect(200);

async function staff() {
  return { editor: await makeUser(ctx, { role: 'EDITOR' }), reviewer: await makeUser(ctx, { role: 'REVIEWER' }), admin: await makeUser(ctx, { role: 'ADMIN' }) };
}

describe('two-person resolution and scoring', () => {
  it('the person who entered the outcome cannot confirm it; a different person can, and scoring runs', async () => {
    const { editor, reviewer } = await staff();
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await fc(a.auth, q.id, 'opt0', 75);
    await fc(b.auth, q.id, 'opt1', 90);
    // cannot resolve before lock
    await ctx.http().post(`/api/admin/questions/${q.id}/resolve`).set(editor.auth).send({ winningOptionId: 'opt0', sourceUrl: 'https://x.sa/r' }).expect(409);
    ctx.clock.advance(H + 1000);
    await ctx.http().post(`/api/admin/questions/${q.id}/resolve`).set(editor.auth).send({ winningOptionId: 'opt0', sourceUrl: 'https://x.sa/r' }).expect(200);
    expect(await ctx.prisma.score.count()).toBe(0); // nothing scored before confirmation
    const same = await ctx.http().post(`/api/admin/questions/${q.id}/confirm`).set(editor.auth).send({}).expect(403);
    expect(same.body.error.code).toBe('SAME_PERSON');
    await ctx.http().post(`/api/admin/questions/${q.id}/confirm`).set(reviewer.auth).send({}).expect(200);
    const scores = await ctx.prisma.score.findMany({ orderBy: { points: 'desc' } });
    expect(scores.map((s) => [s.userId, s.points])).toEqual([
      [a.user.id, 58],
      [b.user.id, -232],
    ]);
    expect((await ctx.prisma.question.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('RESOLVED');
    const detail = await ctx.http().get(`/api/questions/${q.id}`).set(a.auth).expect(200);
    expect(detail.body.myScore).toEqual({ points: 58, correct: true });
    expect(detail.body.resolution.winningOptionId).toBe('opt0');
    const stats = await ctx.http().get('/api/me/stats').set(a.auth).expect(200);
    expect(stats.body).toMatchObject({ seasonPoints: 58, weekPoints: 58, scoredForecasts: 1, accuracy: null });
    const actions = (await ctx.prisma.auditLog.findMany({ where: { entityId: q.id }, orderBy: { createdAt: 'asc' } })).map((x) => x.action);
    expect(actions).toEqual(['resolution.propose', 'resolution.confirm']);
  });

  it('plain users cannot resolve', async () => {
    const u = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx, { status: 'LOCKED' });
    await ctx.http().post(`/api/admin/questions/${q.id}/resolve`).set(u.auth).send({ winningOptionId: 'opt0', sourceUrl: 'https://x.sa/r' }).expect(403);
  });
});

describe('void', () => {
  it('a voided question scores nothing for anyone, including after resolution', async () => {
    const { editor, reviewer } = await staff();
    const a = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await fc(a.auth, q.id, 'opt0', 90);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    expect(await ctx.prisma.score.count()).toBe(1);
    await ctx.http().post(`/api/admin/questions/${q.id}/void`).set(editor.auth).send({ reason: 'AMBIGUOUS' }).expect(200);
    expect(await ctx.prisma.score.count()).toBe(0);
    const d = await ctx.http().get(`/api/questions/${q.id}`).set(a.auth).expect(200);
    expect(d.body).toMatchObject({ status: 'VOID', voidReason: 'AMBIGUOUS', resolution: null, myScore: null });
    expect((await ctx.http().get('/api/me/stats').set(a.auth)).body.seasonPoints).toBe(0);
  });

  it('LIVE questions can be voided (postponed); FINAL ones only by an admin', async () => {
    const { editor, reviewer, admin } = await staff();
    const q = await makeLiveQuestion(ctx);
    await ctx.http().post(`/api/admin/questions/${q.id}/void`).set(editor.auth).send({ reason: 'POSTPONED' }).expect(200);
    const q2 = await makeLiveQuestion(ctx);
    await resolveViaApi(ctx, q2.id, 'opt1', editor.auth, reviewer.auth);
    ctx.clock.advance(13 * H);
    await ctx.app.get(ResolutionService).finalizeDue();
    await ctx.http().post(`/api/admin/questions/${q2.id}/void`).set(editor.auth).send({ reason: 'SOURCE_UNAVAILABLE_48H' }).expect(403);
    await ctx.http().post(`/api/admin/questions/${q2.id}/void`).set(admin.auth).send({ reason: 'SOURCE_UNAVAILABLE_48H' }).expect(200);
  });
});

describe('dispute window, finalize and corrections', () => {
  it('reports are only accepted during the 12h window; FINAL waits for open disputes', async () => {
    const { editor, reviewer, admin } = await staff();
    const a = await makeUser(ctx);
    const outsider = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await fc(a.auth, q.id, 'opt1', 60);
    const body = { evidenceUrl: 'https://example.com/proof', message: 'The official close was lower.' };
    await ctx.http().post(`/api/questions/${q.id}/disputes`).set(a.auth).send(body).expect(409); // not resolved yet
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    await ctx.http().post(`/api/questions/${q.id}/disputes`).set(outsider.auth).send(body).expect(403);
    const rep = await ctx.http().post(`/api/questions/${q.id}/disputes`).set(a.auth).send(body).expect(201);
    expect((await ctx.http().post(`/api/questions/${q.id}/disputes`).set(a.auth).send(body).expect(409)).body.error.code).toBe('ALREADY_REPORTED');
    ctx.clock.advance(12 * H + 1000);
    expect((await ctx.http().post(`/api/questions/${q.id}/disputes`).set(outsider.auth).send(body).expect(409)).body.error.code).toBe('DISPUTE_WINDOW_CLOSED');
    const svc = ctx.app.get(ResolutionService);
    expect(await svc.finalizeDue()).toEqual({ finalized: 0 }); // open dispute blocks FINAL
    const queue = await ctx.http().get('/api/admin/disputes?status=OPEN').set(admin.auth).expect(200);
    expect(queue.body).toHaveLength(1);
    await ctx.http().post(`/api/admin/disputes/${rep.body.id}/decide`).set(admin.auth).send({ decision: 'REJECTED', note: 'Source confirms the result.' }).expect(200);
    expect(await svc.finalizeDue()).toEqual({ finalized: 1 });
    const fq = await ctx.prisma.question.findUniqueOrThrow({ where: { id: q.id }, include: { resolution: true } });
    expect(fq.status).toBe('FINAL');
    expect(fq.resolution?.finalizedAt).not.toBeNull();
  });

  it('does not finalize before 12h', async () => {
    const { editor, reviewer } = await staff();
    const q = await makeLiveQuestion(ctx);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    ctx.clock.advance(11 * H);
    expect(await ctx.app.get(ResolutionService).finalizeDue()).toEqual({ finalized: 0 });
  });

  it('correction after FINAL re-scores everyone affected and shows a visible note', async () => {
    const { editor, reviewer, admin } = await staff();
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    await fc(a.auth, q.id, 'opt0', 60);
    await fc(b.auth, q.id, 'opt1', 75);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    ctx.clock.advance(13 * H);
    await ctx.app.get(ResolutionService).finalizeDue();
    const body = { winningOptionId: 'opt1', sourceUrl: 'https://www.saudiexchange.sa/corrected', correctionNote: 'Exchange revised the official close.' };
    await ctx.http().post(`/api/admin/questions/${q.id}/correct`).set(editor.auth).send(body).expect(403);
    const res = await ctx.http().post(`/api/admin/questions/${q.id}/correct`).set(admin.auth).send(body).expect(200);
    expect(res.body.affected).toBe(2);
    const pts = Object.fromEntries((await ctx.prisma.score.findMany()).map((s) => [s.userId, s.points]));
    expect(pts).toEqual({ [a.user.id]: -32, [b.user.id]: 58 });
    const d = await ctx.http().get(`/api/questions/${q.id}`).set(a.auth).expect(200);
    expect(d.body.resolution.correctionNote).toBe('Exchange revised the official close.');
    expect(d.body.myScore).toEqual({ points: -32, correct: false });
    expect(await ctx.prisma.auditLog.count({ where: { action: 'resolution.correct' } })).toBe(1);
  });
});

describe('accuracy rating', () => {
  it('is hidden below 20 scored forecasts and averages the last 30 days after that', async () => {
    const { editor, reviewer } = await staff();
    const a = await makeUser(ctx);
    for (let i = 0; i < 20; i++) {
      const q = await makeLiveQuestion(ctx, { lockInMs: 60_000 });
      await fc(a.auth, q.id, 'opt0', 75);
      await resolveViaApi(ctx, q.id, i % 4 === 0 ? 'opt1' : 'opt0', editor.auth, reviewer.auth); // 15 right (+58), 5 wrong (-100)
      if (i === 18) expect((await ctx.http().get('/api/me/stats').set(a.auth)).body.accuracy).toBeNull();
    }
    const s = (await ctx.http().get('/api/me/stats').set(a.auth)).body;
    expect(s.scoredForecasts).toBe(20);
    expect(s.accuracy).toBe(Math.round((15 * 58 - 5 * 100) / 20)); // 19
  });
});
