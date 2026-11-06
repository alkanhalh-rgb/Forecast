import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DuelsService } from '../src/duels/duels.service';
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
const create = (auth: Auth, body: object) => ctx.http().post('/api/duels').set(auth).send(body);
const accept = (auth: Auth, id: string, body: object) => ctx.http().post(`/api/duels/${id}/accept`).set(auth).send(body);
const rating = async (auth: Auth) => (await ctx.http().get('/api/duels/rating/me').set(auth).expect(200)).body;

async function setup() {
  return {
    editor: await makeUser(ctx, { role: 'EDITOR' }),
    reviewer: await makeUser(ctx, { role: 'REVIEWER' }),
    admin: await makeUser(ctx, { role: 'ADMIN' }),
    a: await makeUser(ctx, { nickname: 'challenger1' }),
    b: await makeUser(ctx, { nickname: 'opponent1' }),
  };
}

describe('SINGLE duel', () => {
  it('opponent must pick a different option; the winner gains Elo; points are untouched', async () => {
    const { editor, reviewer, a, b } = await setup();
    const q = await makeLiveQuestion(ctx);
    const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
    expect(d.body.status).toBe('PENDING');
    await accept(a.auth, d.body.id, { optionId: 'opt1' }).expect(400); // cannot accept own
    expect((await accept(b.auth, d.body.id, { optionId: 'opt0' }).expect(400)).body.error.code).toBe('DUEL_SAME_OPTION');
    await accept(b.auth, d.body.id, { optionId: 'opt1' }).expect(200);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    const v = await ctx.http().get(`/api/duels/${d.body.id}`).set(a.auth).expect(200);
    expect(v.body).toMatchObject({ status: 'DONE', winner: 'CHALLENGER', myEloDelta: 16 });
    expect(await rating(a.auth)).toEqual({ rating: 1216, duelsPlayed: 1, wins: 1 });
    expect(await rating(b.auth)).toEqual({ rating: 1184, duelsPlayed: 1, wins: 0 });
    // Elo is separate: no Score rows exist for duel picks (neither user forecast)
    expect(await ctx.prisma.score.count()).toBe(0);
    expect((await ctx.http().get('/api/me/stats').set(a.auth)).body.seasonPoints).toBe(0);
  });

  it('a draw on a 3-way question is a tie (0.5 each)', async () => {
    const { editor, reviewer, a, b } = await setup();
    const q = await makeLiveQuestion(ctx, { options: 3 });
    const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
    await accept(b.auth, d.body.id, { optionId: 'opt2' }).expect(200);
    await resolveViaApi(ctx, q.id, 'opt1', editor.auth, reviewer.auth);
    const duel = await ctx.prisma.duel.findUniqueOrThrow({ where: { id: d.body.id } });
    expect(duel).toMatchObject({ status: 'DONE', winnerId: null, challengerEloDelta: 0, opponentEloDelta: 0 });
    expect((await rating(a.auth)).duelsPlayed).toBe(1);
  });

  it('a voided question makes the duel VOID and reverses Elo', async () => {
    const { editor, reviewer, admin, a, b } = await setup();
    const q = await makeLiveQuestion(ctx);
    const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
    await accept(b.auth, d.body.id, { optionId: 'opt1' }).expect(200);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    expect((await rating(a.auth)).rating).toBe(1216);
    await ctx.http().post(`/api/admin/questions/${q.id}/void`).set(admin.auth).send({ reason: 'AMBIGUOUS' }).expect(200);
    expect((await ctx.prisma.duel.findUniqueOrThrow({ where: { id: d.body.id } })).status).toBe('VOID');
    expect(await rating(a.auth)).toEqual({ rating: 1200, duelsPlayed: 0, wins: 0 });
    expect(await rating(b.auth)).toEqual({ rating: 1200, duelsPlayed: 0, wins: 0 });
  });

  it('a correction flips the winner and the Elo', async () => {
    const { editor, reviewer, admin, a, b } = await setup();
    const q = await makeLiveQuestion(ctx);
    const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
    await accept(b.auth, d.body.id, { optionId: 'opt1' }).expect(200);
    await resolveViaApi(ctx, q.id, 'opt0', editor.auth, reviewer.auth);
    await ctx.http().post(`/api/admin/questions/${q.id}/correct`).set(admin.auth).send({ winningOptionId: 'opt1', sourceUrl: 'https://x.sa/c', correctionNote: 'Revised official result.' }).expect(200);
    expect(await rating(a.auth)).toEqual({ rating: 1184, duelsPlayed: 1, wins: 0 });
    expect(await rating(b.auth)).toEqual({ rating: 1216, duelsPlayed: 1, wins: 1 });
  });

  it('unaccepted challenges expire at the question lock', async () => {
    const { a, b } = await setup();
    const q = await makeLiveQuestion(ctx, { lockInMs: 60_000 });
    const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
    ctx.clock.advance(60_000);
    expect((await accept(b.auth, d.body.id, { optionId: 'opt1' }).expect(409)).body.error.code).toBe('DUEL_NOT_OPEN');
    await ctx.app.get(DuelsService).expireDue();
    expect((await ctx.prisma.duel.findUniqueOrThrow({ where: { id: d.body.id } })).status).toBe('EXPIRED');
  });

  it('max 3 duels per week between the same two users', async () => {
    const { a, b } = await setup();
    const q = await makeLiveQuestion(ctx);
    for (let i = 0; i < 3; i++) {
      const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
      await accept(b.auth, d.body.id, { optionId: 'opt1' }).expect(200);
    }
    const d4 = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0' }).expect(201);
    expect((await accept(b.auth, d4.body.id, { optionId: 'opt1' }).expect(409)).body.error.code).toBe('DUEL_PAIR_LIMIT');
    // direct challenges by nickname are checked at creation, in either direction
    expect((await create(b.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0', opponentNickname: 'challenger1' }).expect(409)).body.error.code).toBe('DUEL_PAIR_LIMIT');
    // a third person is fine
    const c = await makeUser(ctx);
    await accept(c.auth, d4.body.id, { optionId: 'opt1' }).expect(200);
  });

  it('a direct challenge can only be accepted by the named opponent', async () => {
    const { a, b } = await setup();
    const c = await makeUser(ctx);
    const q = await makeLiveQuestion(ctx);
    const d = await create(a.auth, { format: 'SINGLE', questionId: q.id, optionId: 'opt0', opponentNickname: 'OPPONENT1' }).expect(201);
    await accept(c.auth, d.body.id, { optionId: 'opt1' }).expect(403);
    await accept(b.auth, d.body.id, { optionId: 'opt1' }).expect(200);
  });
});

describe('BEST_OF_3 duel', () => {
  async function bo3() {
    const s = await setup();
    const q1 = await makeLiveQuestion(ctx);
    const q2 = await makeLiveQuestion(ctx);
    const q3 = await makeLiveQuestion(ctx, { lockInMs: 2 * 3600_000 });
    await makeLiveQuestion(ctx, { lockInMs: 30 * 3600_000 }); // not eligible for Q3 (locks after 24h)
    const d = await create(s.a.auth, { format: 'BEST_OF_3', questionId: q1.id, optionId: 'opt0' }).expect(201);
    const acc = await accept(s.b.auth, d.body.id, { optionId: 'opt1', q2QuestionId: q2.id, q2OptionId: 'opt0' }).expect(200);
    return { ...s, q1, q2, q3, id: d.body.id as string, acc: acc.body };
  }

  it('Q3 is picked by the system from LIVE questions locking within 24h; picks follow the rules', async () => {
    const { a, b, q3, id, acc } = await bo3();
    expect(acc.questions.map((x: { pickedBy: string }) => x.pickedBy)).toEqual(['CHALLENGER', 'OPPONENT', 'SYSTEM']);
    expect(acc.questions[2].question.id).toBe(q3.id);
    expect((await ctx.http().post(`/api/duels/${id}/answer`).set(a.auth).send({ order: 2, optionId: 'opt0' }).expect(400)).body.error.code).toBe('DUEL_SAME_OPTION');
    await ctx.http().post(`/api/duels/${id}/answer`).set(b.auth).send({ order: 2, optionId: 'opt1' }).expect(403);
    await ctx.http().post(`/api/duels/${id}/answer`).set(a.auth).send({ order: 2, optionId: 'opt1' }).expect(200);
    await ctx.http().post(`/api/duels/${id}/answer`).set(a.auth).send({ order: 3, optionId: 'opt0' }).expect(200);
    // Q3 picks are independent: b cannot see a's pick yet, and may pick the same option
    const vb = await ctx.http().get(`/api/duels/${id}`).set(b.auth).expect(200);
    expect(vb.body.questions[2].challengerOptionId).toBe('HIDDEN');
    await ctx.http().post(`/api/duels/${id}/answer`).set(b.auth).send({ order: 3, optionId: 'opt0' }).expect(200);
  });

  it('more question wins wins; equal wins is a tie; a void counts as no result', async () => {
    const { editor, reviewer, admin, a, b, q1, q2, q3, id } = await bo3();
    await ctx.http().post(`/api/duels/${id}/answer`).set(a.auth).send({ order: 2, optionId: 'opt1' }).expect(200);
    await ctx.http().post(`/api/duels/${id}/answer`).set(a.auth).send({ order: 3, optionId: 'opt0' }).expect(200);
    await ctx.http().post(`/api/duels/${id}/answer`).set(b.auth).send({ order: 3, optionId: 'opt1' }).expect(200);
    await resolveViaApi(ctx, q1.id, 'opt0', editor.auth, reviewer.auth); // a
    expect((await ctx.prisma.duel.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
    await resolveViaApi(ctx, q2.id, 'opt0', editor.auth, reviewer.auth); // b
    await resolveViaApi(ctx, q3.id, 'opt0', editor.auth, reviewer.auth); // a
    let duel = await ctx.prisma.duel.findUniqueOrThrow({ where: { id } });
    expect(duel).toMatchObject({ status: 'DONE', winnerId: a.user.id });
    // void Q3 -> 1:1 -> tie
    await ctx.http().post(`/api/admin/questions/${q3.id}/void`).set(admin.auth).send({ reason: 'ABANDONED' }).expect(200);
    duel = await ctx.prisma.duel.findUniqueOrThrow({ where: { id } });
    expect(duel).toMatchObject({ status: 'DONE', winnerId: null, challengerEloDelta: 0 });
    expect(await rating(a.auth)).toEqual({ rating: 1200, duelsPlayed: 1, wins: 0 });
    // void the rest -> no results left -> VOID
    await ctx.http().post(`/api/admin/questions/${q1.id}/void`).set(admin.auth).send({ reason: 'ABANDONED' }).expect(200);
    await ctx.http().post(`/api/admin/questions/${q2.id}/void`).set(admin.auth).send({ reason: 'ABANDONED' }).expect(200);
    expect((await ctx.prisma.duel.findUniqueOrThrow({ where: { id } })).status).toBe('VOID');
    expect(await rating(b.auth)).toEqual({ rating: 1200, duelsPlayed: 0, wins: 0 });
  });

  it('fails cleanly when no question is available for Q3', async () => {
    const { a, b } = await setup();
    const q1 = await makeLiveQuestion(ctx);
    const q2 = await makeLiveQuestion(ctx);
    const d = await create(a.auth, { format: 'BEST_OF_3', questionId: q1.id, optionId: 'opt0' }).expect(201);
    expect((await accept(b.auth, d.body.id, { optionId: 'opt1', q2QuestionId: q2.id, q2OptionId: 'opt0' }).expect(409)).body.error.code).toBe('DUEL_NO_Q3');
    expect((await ctx.prisma.duel.findUniqueOrThrow({ where: { id: d.body.id } })).status).toBe('PENDING');
  });
});
