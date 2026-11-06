import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { Duel, DuelQuestion, Prisma, Question, Resolution, User } from '@app/db';
import { challengerEloResult, DAY_MS, DUEL_PAIR_WEEKLY_LIMIT, DuelQuestionOutcome, duelOutcome, ELO_START, eloUpdate, weekStart } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { AppError, conflict, forbidden, notFound } from '../common/errors';
import { DomainEvents } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { SweeperService } from '../jobs/sweeper.service';
import { options } from '../questions/question.mapper';

type DuelFull = Duel & { questions: (DuelQuestion & { question: Question & { resolution: Resolution | null } })[] };
const FULL = { questions: { include: { question: { include: { resolution: true, category: true } } }, orderBy: { order: 'asc' as const } } };

/**
 * Duels carry no value of any kind: the winner gets a badge and a rating (Elo) change only.
 * Elo lives in DuelRating and never touches Score, season points or leaderboards.
 */
@Injectable()
export class DuelsService implements OnModuleInit {
  constructor(private prisma: PrismaService, private clock: ClockService, private events: DomainEvents, private sweeper: SweeperService) {}

  onModuleInit() {
    this.events.on('question.scored', (e) => this.recomputeForQuestion(e.questionId));
    this.sweeper.register('duelExpiry', () => this.expireDue());
  }

  private openQuestion(q: Question | null): Question {
    if (!q || q.status !== 'LIVE' || q.lockAt <= this.clock.now()) throw new AppError('QUESTION_LOCKED', HttpStatus.CONFLICT);
    return q;
  }

  private validOption(q: Question, optionId: string) {
    if (!options(q).some((o) => o.id === optionId)) throw new AppError('INVALID_OPTION');
  }

  /** Max 3 accepted (or directed) duels per Riyadh week between the same two users. */
  private async checkPairLimit(a: string, b: string) {
    const ws = weekStart(this.clock.now());
    const n = await this.prisma.duel.count({
      where: {
        weekStart: ws,
        status: { in: ['PENDING', 'ACTIVE', 'DONE', 'VOID'] },
        OR: [
          { challengerId: a, opponentId: b },
          { challengerId: b, opponentId: a },
        ],
      },
    });
    if (n >= DUEL_PAIR_WEEKLY_LIMIT) throw conflict('DUEL_PAIR_LIMIT');
  }

  async create(challenger: User, input: { format: 'SINGLE' | 'BEST_OF_3'; questionId: string; optionId: string; opponentNickname?: string }) {
    const q = this.openQuestion(await this.prisma.question.findUnique({ where: { id: input.questionId } }));
    this.validOption(q, input.optionId);
    let opponentId: string | null = null;
    if (input.opponentNickname) {
      const opp = await this.prisma.user.findFirst({ where: { nickname: { equals: input.opponentNickname, mode: 'insensitive' }, ageConfirmedAt: { not: null } } });
      if (!opp) throw new AppError('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (opp.id === challenger.id) throw new AppError('DUEL_SELF');
      await this.checkPairLimit(challenger.id, opp.id);
      opponentId = opp.id;
    }
    const duel = await this.prisma.duel.create({
      data: {
        format: input.format,
        challengerId: challenger.id,
        opponentId,
        expiresAt: q.lockAt, // unaccepted challenges expire at the question's lock
        weekStart: weekStart(this.clock.now()),
        questions: { create: { questionId: q.id, order: 1, pickedBy: 'CHALLENGER', challengerOptionId: input.optionId } },
      },
    });
    if (opponentId) await this.events.emit('duel.challenged', { duelId: duel.id });
    return this.view(duel.id, challenger.id);
  }

  async accept(opponent: User, id: string, input: { optionId: string; q2QuestionId?: string; q2OptionId?: string }) {
    const d = await this.load(id);
    const now = this.clock.now();
    if (d.status !== 'PENDING' || d.expiresAt <= now) throw new AppError('DUEL_NOT_OPEN', HttpStatus.CONFLICT);
    if (d.challengerId === opponent.id) throw new AppError('DUEL_SELF');
    if (d.opponentId && d.opponentId !== opponent.id) throw forbidden();
    if (!d.opponentId) await this.checkPairLimit(d.challengerId, opponent.id);
    const q1 = d.questions[0]!;
    this.openQuestion(q1.question);
    this.validOption(q1.question, input.optionId);
    if (input.optionId === q1.challengerOptionId) throw new AppError('DUEL_SAME_OPTION');

    const extra: Prisma.DuelQuestionCreateManyInput[] = [];
    if (d.format === 'BEST_OF_3') {
      if (!input.q2QuestionId || !input.q2OptionId) throw new AppError('VALIDATION');
      if (input.q2QuestionId === q1.questionId) throw new AppError('VALIDATION', HttpStatus.BAD_REQUEST, 'Q2 must differ from Q1');
      const q2 = this.openQuestion(await this.prisma.question.findUnique({ where: { id: input.q2QuestionId } }));
      this.validOption(q2, input.q2OptionId);
      // Q3: picked at random by the system from LIVE questions locking within 24 hours
      const pool = await this.prisma.question.findMany({
        where: { status: 'LIVE', lockAt: { gt: now, lte: new Date(now.getTime() + DAY_MS) }, id: { notIn: [q1.questionId, q2.id] } },
        select: { id: true },
      });
      if (pool.length === 0) throw new AppError('DUEL_NO_Q3', HttpStatus.CONFLICT);
      const q3 = pool[randomInt(0, pool.length)]!;
      extra.push({ duelId: id, questionId: q2.id, order: 2, pickedBy: 'OPPONENT', opponentOptionId: input.q2OptionId });
      extra.push({ duelId: id, questionId: q3.id, order: 3, pickedBy: 'SYSTEM' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.duel.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACTIVE', opponentId: opponent.id, acceptedAt: now } });
      if (res.count === 0) throw new AppError('DUEL_NOT_OPEN', HttpStatus.CONFLICT);
      await tx.duelQuestion.update({ where: { id: q1.id }, data: { opponentOptionId: input.optionId } });
      if (extra.length) await tx.duelQuestion.createMany({ data: extra });
      return res;
    });
    void updated;
    return this.view(id, opponent.id);
  }

  /** BEST_OF_3 follow-up answers: challenger on Q2 (must differ), either player on Q3 (independent). */
  async answer(user: User, id: string, input: { order: number; optionId: string }) {
    const d = await this.load(id);
    if (d.status !== 'ACTIVE' || d.format !== 'BEST_OF_3') throw new AppError('DUEL_NOT_OPEN', HttpStatus.CONFLICT);
    const side = user.id === d.challengerId ? 'challenger' : user.id === d.opponentId ? 'opponent' : null;
    if (!side) throw forbidden();
    const dq = d.questions.find((q) => q.order === input.order);
    if (!dq || input.order === 1) throw new AppError('VALIDATION');
    this.openQuestion(dq.question);
    this.validOption(dq.question, input.optionId);
    if (input.order === 2) {
      if (side !== 'challenger') throw forbidden();
      if (input.optionId === dq.opponentOptionId) throw new AppError('DUEL_SAME_OPTION');
    }
    const field = side === 'challenger' ? 'challengerOptionId' : 'opponentOptionId';
    if (dq[field]) throw conflict('INVALID_STATE');
    await this.prisma.duelQuestion.update({ where: { id: dq.id }, data: { [field]: input.optionId } });
    return this.view(id, user.id);
  }

  async expireDue() {
    const res = await this.prisma.duel.updateMany({ where: { status: 'PENDING', expiresAt: { lte: this.clock.now() } }, data: { status: 'EXPIRED' } });
    return { expired: res.count };
  }

  private load(id: string): Promise<DuelFull> {
    return this.prisma.duel.findUnique({ where: { id }, include: FULL }).then((d) => {
      if (!d) throw notFound();
      return d as DuelFull;
    });
  }

  private outcomeInput(d: DuelFull): DuelQuestionOutcome[] {
    return d.questions.map((dq) => {
      const q = dq.question;
      const winningOptionId = q.status === 'VOID' ? 'VOID' : (q.status === 'RESOLVED' || q.status === 'FINAL') && q.resolution ? q.resolution.winningOptionId : null;
      return { winningOptionId, challengerOptionId: dq.challengerOptionId, opponentOptionId: dq.opponentOptionId };
    });
  }

  async recomputeForQuestion(questionId: string) {
    const links = await this.prisma.duelQuestion.findMany({ where: { questionId }, select: { duelId: true } });
    for (const { duelId } of links) await this.recompute(duelId);
  }

  private async rating(userId: string) {
    return this.prisma.duelRating.upsert({ where: { userId }, update: {}, create: { userId, rating: ELO_START } });
  }

  /**
   * Decides (or re-decides after a void/correction) a duel. Previous Elo deltas are reversed
   * before the new result is applied, so ratings always reflect the latest outcomes.
   */
  async recompute(id: string) {
    const d = await this.load(id);
    if (d.status === 'EXPIRED') return d;
    if (d.status === 'PENDING') {
      // a voided question kills an unaccepted challenge
      if (d.questions[0]!.question.status === 'VOID') await this.prisma.duel.update({ where: { id }, data: { status: 'VOID' } });
      return d;
    }
    const outcome = duelOutcome(this.outcomeInput(d));
    if (outcome.state === 'PENDING') return d;
    const opponentId = d.opponentId!;
    const firstDecision = d.decidedAt === null;
    const prevWinner = d.winnerId;

    const ca = await this.rating(d.challengerId);
    const cb = await this.rating(opponentId);
    const baseA = ca.rating - (d.challengerEloDelta ?? 0);
    const baseB = cb.rating - (d.opponentEloDelta ?? 0);
    const playedBefore = d.challengerEloDelta !== null;

    let status: Duel['status'];
    let winnerId: string | null = null;
    let deltaA: number | null = null;
    let deltaB: number | null = null;
    if (outcome.state === 'VOID') status = 'VOID';
    else {
      status = 'DONE';
      winnerId = outcome.winner === 'CHALLENGER' ? d.challengerId : outcome.winner === 'OPPONENT' ? opponentId : null;
      const r = eloUpdate(baseA, baseB, challengerEloResult(outcome));
      deltaA = r.deltaA;
      deltaB = r.deltaB;
    }
    const nowPlayed = deltaA !== null;
    const playedChange = (nowPlayed ? 1 : 0) - (playedBefore ? 1 : 0);
    const winChange = (uid: string) => (winnerId === uid ? 1 : 0) - (prevWinner === uid ? 1 : 0);

    await this.prisma.$transaction([
      this.prisma.duelRating.update({ where: { userId: d.challengerId }, data: { rating: baseA + (deltaA ?? 0), duelsPlayed: { increment: playedChange }, wins: { increment: winChange(d.challengerId) } } }),
      this.prisma.duelRating.update({ where: { userId: opponentId }, data: { rating: baseB + (deltaB ?? 0), duelsPlayed: { increment: playedChange }, wins: { increment: winChange(opponentId) } } }),
      this.prisma.duel.update({ where: { id }, data: { status, winnerId, challengerEloDelta: deltaA, opponentEloDelta: deltaB, decidedAt: d.decidedAt ?? this.clock.now() } }),
    ]);
    if (firstDecision || prevWinner !== winnerId) await this.events.emit('duel.decided', { duelId: id });
    return this.load(id);
  }

  /** What a viewer may see. On Q3 (independent picks) the other side stays hidden until you answer or it locks. */
  async view(id: string, viewerId: string | null) {
    const d = await this.load(id);
    const users = await this.prisma.user.findMany({ where: { id: { in: [d.challengerId, d.opponentId ?? ''] } }, select: { id: true, nickname: true } });
    const nick = new Map(users.map((u) => [u.id, u.nickname]));
    const side = viewerId === d.challengerId ? 'challenger' : viewerId === d.opponentId ? 'opponent' : null;
    const now = this.clock.now();
    const outcomes = this.outcomeInput(d);
    const out = duelOutcome(outcomes);
    return {
      id: d.id,
      format: d.format,
      status: d.status,
      challenger: { nickname: nick.get(d.challengerId) ?? null },
      opponent: d.opponentId ? { nickname: nick.get(d.opponentId) ?? null } : null,
      directed: !!d.opponentId,
      mySide: side,
      winner: d.winnerId ? (d.winnerId === d.challengerId ? 'CHALLENGER' : 'OPPONENT') : null,
      score: out.state === 'DONE' ? { challenger: out.challengerWins, opponent: out.opponentWins } : null,
      myEloDelta: side === 'challenger' ? d.challengerEloDelta : side === 'opponent' ? d.opponentEloDelta : null,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
      questions: d.questions.map((dq, i) => {
        const q = dq.question;
        const locked = q.lockAt <= now || q.status !== 'LIVE';
        let c = dq.challengerOptionId;
        let o = dq.opponentOptionId;
        if (dq.order === 3 && !locked) {
          if (side !== 'challenger') c = c ? 'HIDDEN' : null;
          if (side !== 'opponent') o = o ? 'HIDDEN' : null;
        }
        return {
          order: dq.order,
          pickedBy: dq.pickedBy,
          question: { id: q.id, textAr: q.textAr, textEn: q.textEn, options: options(q), lockAt: q.lockAt, status: q.status, category: (q as unknown as { category: unknown }).category },
          challengerOptionId: c,
          opponentOptionId: o,
          winningOptionId: outcomes[i]!.winningOptionId,
        };
      }),
    };
  }

  async mine(userId: string) {
    const ds = await this.prisma.duel.findMany({ where: { OR: [{ challengerId: userId }, { opponentId: userId }] }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true } });
    return Promise.all(ds.map((d) => this.view(d.id, userId)));
  }

  async myRating(userId: string) {
    const r = await this.prisma.duelRating.findUnique({ where: { userId } });
    return { rating: r?.rating ?? ELO_START, duelsPlayed: r?.duelsPlayed ?? 0, wins: r?.wins ?? 0 };
  }
}
