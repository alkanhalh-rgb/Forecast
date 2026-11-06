import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { User } from '@app/db';
import { canForecast, isConfidence } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { AppError, notFound } from '../common/errors';
import { DomainEvents } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { QueueService, QUEUES } from '../jobs/queue.service';
import { CrowdService } from '../questions/crowd.service';
import { options } from '../questions/question.mapper';

export interface ForecastJob {
  userId: string;
  questionId: string;
  optionId: string;
  confidence: number;
  submittedAt: string;
}

const REJECT = { NOT_LIVE: 'QUESTION_NOT_LIVE', LOCKED: 'QUESTION_LOCKED' } as const;

/**
 * Forecast writes go through a queue to absorb spikes (kickoff, market open).
 * The lock is enforced twice on the server: at the API edge (now < lockAt) and in the worker
 * (submittedAt < lockAt). Client state is never trusted.
 */
@Injectable()
export class ForecastsService implements OnModuleInit {
  private log = new Logger('Forecasts');

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private queues: QueueService,
    private crowd: CrowdService,
    private events: DomainEvents,
  ) {}

  onModuleInit() {
    this.queues.register(QUEUES.forecasts, 'apply', (d: ForecastJob) => this.apply(d), 8);
  }

  async submit(user: User, input: { questionId: string; optionId: string; confidence: number }) {
    const now = this.clock.now();
    const q = await this.prisma.question.findUnique({ where: { id: input.questionId } });
    if (!q) throw notFound();
    const check = canForecast(q, now);
    if (!check.ok) throw new AppError(REJECT[check.reason], HttpStatus.CONFLICT);
    if (!options(q).some((o) => o.id === input.optionId)) throw new AppError('INVALID_OPTION');
    if (!isConfidence(input.confidence)) throw new AppError('VALIDATION');

    const job: ForecastJob = { userId: user.id, ...input, submittedAt: now.toISOString() };
    const handle = await this.queues.add(QUEUES.forecasts, 'apply', job);
    const result = (await handle.wait(3000)) as Awaited<ReturnType<ForecastsService['apply']>> | null;
    if (!result) return { status: 'queued' as const };
    if (!result.ok) throw new AppError(result.code, HttpStatus.CONFLICT);
    return { status: 'saved' as const, forecast: result.forecast, crowd: await this.crowd.get(q.id, options(q).map((o) => o.id)) };
  }

  /** Worker: idempotent, "last submission wins", keeps the Redis crowd counters in step. */
  async apply(job: ForecastJob) {
    const submittedAt = new Date(job.submittedAt);
    const q = await this.prisma.question.findUnique({ where: { id: job.questionId } });
    if (!q) return { ok: false as const, code: 'NOT_FOUND' };
    // A question may have been locked by the job while this submission was queued: judge by submission time.
    const statusAtSubmit = q.status === 'LOCKED' ? 'LIVE' : q.status;
    const check = canForecast({ status: statusAtSubmit, lockAt: q.lockAt }, submittedAt);
    if (!check.ok) return { ok: false as const, code: REJECT[check.reason] };

    const { prev, forecast, first } = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; optionId: string; updatedAt: Date }[]>`
        SELECT id, "optionId", "updatedAt" FROM "Forecast" WHERE "userId" = ${job.userId} AND "questionId" = ${job.questionId} FOR UPDATE`;
      const existing = rows[0];
      if (existing && existing.updatedAt.getTime() > submittedAt.getTime()) {
        // an even newer submission was already applied
        return { prev: existing.optionId, forecast: await tx.forecast.findUniqueOrThrow({ where: { id: existing.id } }), first: false };
      }
      const forecast = existing
        ? await tx.forecast.update({ where: { id: existing.id }, data: { optionId: job.optionId, confidence: job.confidence, updatedAt: submittedAt } })
        : await tx.forecast.create({ data: { userId: job.userId, questionId: job.questionId, optionId: job.optionId, confidence: job.confidence, createdAt: submittedAt, updatedAt: submittedAt } });
      await tx.forecastHistory.create({ data: { forecastId: forecast.id, userId: job.userId, questionId: job.questionId, optionId: job.optionId, confidence: job.confidence, submittedAt } });
      return { prev: existing?.optionId ?? null, forecast, first: !existing };
    });

    await this.crowd.apply(q.id, options(q).map((o) => o.id), prev, forecast.optionId);
    if (q.status === 'LOCKED') await this.crowd.snapshot(q.id); // late pre-lock job: refresh the snapshot
    await this.events.emit('forecast.saved', { userId: job.userId, questionId: q.id, at: submittedAt, first });
    return { ok: true as const, forecast: { optionId: forecast.optionId, confidence: forecast.confidence, updatedAt: forecast.updatedAt } };
  }
}
