import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import type { User } from '@app/db';
import type { VoidReason } from '@app/shared';
import { AuditService } from '../common/audit.service';
import { ClockService } from '../common/clock.service';
import { AppError, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { QueueService, QUEUES } from '../jobs/queue.service';
import { SweeperService } from '../jobs/sweeper.service';
import { CrowdService } from '../questions/crowd.service';
import { LifecycleService } from '../questions/lifecycle.service';
import { DISPUTE_WINDOW_MS, options } from '../questions/question.mapper';
import { ScoringService } from './scoring.service';

const invalid = () => new AppError('INVALID_STATE', HttpStatus.CONFLICT);

/**
 * Resolution is a two-person process: one staff member enters the outcome and source, a different
 * one confirms it, then scoring runs. A 12-hour dispute window follows before the question is FINAL.
 */
@Injectable()
export class ResolutionService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private scoring: ScoringService,
    private crowd: CrowdService,
    private lifecycle: LifecycleService,
    private queues: QueueService,
    private sweeper: SweeperService,
  ) {}

  onModuleInit() {
    this.queues.register(QUEUES.questions, 'finalize', (d: { questionId: string }) => this.finalize(d.questionId));
    this.sweeper.register('finalizeDue', () => this.finalizeDue());
  }

  private async load(id: string) {
    const q = await this.prisma.question.findUnique({ where: { id }, include: { resolution: true } });
    if (!q) throw notFound();
    return q;
  }

  /** Step 1: an editor enters the outcome and its source. */
  async propose(actor: User, id: string, input: { winningOptionId: string; sourceUrl: string }) {
    let q = await this.load(id);
    if (q.status === 'LIVE' && q.lockAt <= this.clock.now()) {
      await this.lifecycle.lock(id);
      q = await this.load(id);
    }
    if (q.status !== 'LOCKED') throw invalid();
    if (q.resolution?.confirmedById) throw invalid();
    if (!options(q).some((o) => o.id === input.winningOptionId)) throw new AppError('INVALID_OPTION');
    const data = { winningOptionId: input.winningOptionId, sourceUrl: input.sourceUrl, resolvedById: actor.id, confirmedById: null, resolvedAt: null };
    const r = await this.prisma.resolution.upsert({ where: { questionId: id }, update: data, create: { questionId: id, ...data } });
    await this.audit.log({ actorId: actor.id, action: 'resolution.propose', entity: 'Question', entityId: id, before: q.resolution, after: r });
    return r;
  }

  /** Step 2: a different person confirms; scoring runs and the dispute window opens. */
  async confirm(actor: User, id: string) {
    const q = await this.load(id);
    if (q.status !== 'LOCKED' || !q.resolution || q.resolution.confirmedById) throw invalid();
    if (q.resolution.resolvedById === actor.id) throw new AppError('SAME_PERSON', HttpStatus.FORBIDDEN, 'confirmer must differ from resolver');
    const now = this.clock.now();
    const updated = await this.prisma.question.updateMany({ where: { id, status: 'LOCKED' }, data: { status: 'RESOLVED' } });
    if (updated.count === 0) throw invalid();
    const r = await this.prisma.resolution.update({ where: { questionId: id }, data: { confirmedById: actor.id, resolvedAt: now } });
    await this.audit.log({ actorId: actor.id, action: 'resolution.confirm', entity: 'Question', entityId: id, before: q.resolution, after: r });
    const deltas = await this.scoring.scoreQuestion(id, 'RESOLVED');
    await this.queues.add(QUEUES.questions, 'finalize', { questionId: id }, { delayMs: DISPUTE_WINDOW_MS, jobId: `finalize-${id}` });
    return { resolution: r, scored: deltas.length };
  }

  /** After the 12h dispute window (and once no dispute is open) the result becomes FINAL. */
  async finalize(id: string) {
    const q = await this.load(id);
    if (q.status !== 'RESOLVED' || !q.resolution?.resolvedAt) return { finalized: false };
    const now = this.clock.now();
    if (now.getTime() < q.resolution.resolvedAt.getTime() + DISPUTE_WINDOW_MS) return { finalized: false };
    const open = await this.prisma.dispute.count({ where: { questionId: id, status: 'OPEN' } });
    if (open > 0) return { finalized: false, openDisputes: open };
    await this.prisma.question.update({ where: { id }, data: { status: 'FINAL' } });
    await this.prisma.resolution.update({ where: { questionId: id }, data: { finalizedAt: now } });
    await this.audit.log({ actorId: null, action: 'question.finalize', entity: 'Question', entityId: id, after: { status: 'FINAL' } });
    return { finalized: true };
  }

  async finalizeDue() {
    const cutoff = new Date(this.clock.now().getTime() - DISPUTE_WINDOW_MS);
    const due = await this.prisma.question.findMany({ where: { status: 'RESOLVED', resolution: { resolvedAt: { lte: cutoff } } }, select: { id: true } });
    let n = 0;
    for (const q of due) if ((await this.finalize(q.id)).finalized) n++;
    return { finalized: n };
  }

  /** Void: postponed/abandoned event, source unavailable 48h, or ambiguous wording. Nobody scores. */
  async void(actor: User, id: string, reason: VoidReason, note?: string) {
    const q = await this.load(id);
    const allowed = ['LIVE', 'LOCKED', 'RESOLVED', ...(actor.role === 'ADMIN' ? ['FINAL'] : [])];
    if (!allowed.includes(q.status)) throw q.status === 'FINAL' ? forbidden() : invalid();
    await this.prisma.question.update({ where: { id }, data: { status: 'VOID', voidReason: reason, voidNote: note ?? null } });
    await this.audit.log({ actorId: actor.id, action: 'question.void', entity: 'Question', entityId: id, before: { status: q.status }, after: { status: 'VOID', reason, note } });
    await this.crowd.drop(id);
    await this.scoring.unscoreQuestion(id);
    return { status: 'VOID' };
  }

  /** Correction (admin): changes the outcome, re-scores everyone affected, shows a public note. */
  async correct(actor: User, id: string, input: { winningOptionId: string; sourceUrl: string; correctionNote: string }) {
    const q = await this.load(id);
    if (!['RESOLVED', 'FINAL'].includes(q.status) || !q.resolution) throw invalid();
    if (!options(q).some((o) => o.id === input.winningOptionId)) throw new AppError('INVALID_OPTION');
    const r = await this.prisma.resolution.update({
      where: { questionId: id },
      data: { winningOptionId: input.winningOptionId, sourceUrl: input.sourceUrl, correctionNote: input.correctionNote, correctedAt: this.clock.now() },
    });
    await this.audit.log({ actorId: actor.id, action: 'resolution.correct', entity: 'Question', entityId: id, before: q.resolution, after: r });
    const deltas = await this.scoring.scoreQuestion(id, 'CORRECTED');
    return { resolution: r, affected: deltas.filter((d) => d.delta !== 0).length };
  }
}
