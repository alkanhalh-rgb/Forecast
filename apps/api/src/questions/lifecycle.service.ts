import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../common/prisma.service';
import { QueueService, QUEUES } from '../jobs/queue.service';
import { SweeperService } from '../jobs/sweeper.service';
import { CrowdService } from './crowd.service';

/** Moves LIVE questions to LOCKED at lockAt and stores the final crowd snapshot. */
@Injectable()
export class LifecycleService implements OnModuleInit {
  private log = new Logger('Lifecycle');

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private crowd: CrowdService,
    private queues: QueueService,
    private sweeper: SweeperService,
  ) {}

  onModuleInit() {
    this.queues.register(QUEUES.questions, 'lock', (d: { questionId: string }) => this.lock(d.questionId));
    this.sweeper.register('lockDue', () => this.lockDue());
  }

  /** Called on publish: a delayed job fires at lockAt (the sweeper is the safety net). */
  scheduleLock(questionId: string, lockAt: Date) {
    return this.queues.add(QUEUES.questions, 'lock', { questionId }, { delayMs: lockAt.getTime() - Date.now(), jobId: `lock-${questionId}` });
  }

  async lock(questionId: string) {
    const now = this.clock.now();
    const res = await this.prisma.question.updateMany({ where: { id: questionId, status: 'LIVE', lockAt: { lte: now } }, data: { status: 'LOCKED' } });
    if (res.count === 0) return { locked: false };
    const snap = await this.crowd.snapshot(questionId);
    this.log.log(`locked ${questionId} (${snap.total} forecasters)`);
    return { locked: true, ...snap };
  }

  async lockDue() {
    const due = await this.prisma.question.findMany({ where: { status: 'LIVE', lockAt: { lte: this.clock.now() } }, select: { id: true } });
    for (const q of due) await this.lock(q.id);
    return { locked: due.length };
  }
}
