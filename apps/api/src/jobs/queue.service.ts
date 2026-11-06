import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { loadConfig } from '../config';
import { RedisService } from '../common/redis.service';

export type JobHandler = (data: any, job?: Job) => Promise<unknown>;

export const QUEUES = {
  forecasts: 'forecasts',
  questions: 'questions',
  scoring: 'scoring',
  leagues: 'leagues',
  duels: 'duels',
  notifications: 'notifications',
  share: 'share',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

interface Registration {
  handlers: Map<string, JobHandler>;
  concurrency: number;
}

/**
 * Thin wrapper over BullMQ. Modules register named handlers per queue; workers start only when
 * API_ROLE is "worker" or "all". With QUEUE_INLINE=true (tests) immediate jobs run in-process.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private log = new Logger('Queues');
  private regs = new Map<QueueName, Registration>();
  private queues = new Map<QueueName, Queue>();
  private events = new Map<QueueName, QueueEvents>();
  private workers: Worker[] = [];
  private cfg = loadConfig();

  constructor(private redis: RedisService) {}

  get inline() {
    return this.cfg.QUEUE_INLINE;
  }

  register(queue: QueueName, name: string, handler: JobHandler, concurrency = 4) {
    const r = this.regs.get(queue) ?? { handlers: new Map(), concurrency };
    r.handlers.set(name, handler);
    r.concurrency = Math.max(r.concurrency, concurrency);
    this.regs.set(queue, r);
  }

  private queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.redis.duplicate(), defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 1000 } } });
      this.queues.set(name, q);
    }
    return q;
  }

  private queueEvents(name: QueueName): QueueEvents {
    let e = this.events.get(name);
    if (!e) {
      e = new QueueEvents(name, { connection: this.redis.duplicate() });
      this.events.set(name, e);
    }
    return e;
  }

  /** Adds a job. `wait` resolves with the job result (or null on timeout). */
  async add(queue: QueueName, name: string, data: unknown, opts: { delayMs?: number; jobId?: string } = {}) {
    if (this.inline) {
      if (opts.delayMs && opts.delayMs > 0) return { id: opts.jobId ?? null, wait: async () => null }; // sweepers cover delayed work in tests
      const h = this.regs.get(queue)?.handlers.get(name);
      if (!h) throw new Error(`no handler ${queue}/${name}`);
      const result = await h(data);
      return { id: opts.jobId ?? null, wait: async () => result };
    }
    const q = this.queue(queue);
    if (opts.jobId) {
      const existing = await q.getJob(opts.jobId);
      if (existing && (await existing.isDelayed())) await existing.remove().catch(() => undefined);
    }
    const job = await q.add(name, data, { delay: Math.max(0, opts.delayMs ?? 0), jobId: opts.jobId });
    return {
      id: job.id ?? null,
      wait: async (timeoutMs = 3000): Promise<unknown> => {
        try {
          return await job.waitUntilFinished(this.queueEvents(queue), timeoutMs);
        } catch (e) {
          if (String(e).includes('timed out')) return null;
          throw e;
        }
      },
    };
  }

  async addRepeatable(queue: QueueName, name: string, repeat: { pattern?: string; every?: number; tz?: string }) {
    if (this.inline) return;
    await this.queue(queue).upsertJobScheduler(`${queue}:${name}`, repeat, { name, data: {} });
  }

  onApplicationBootstrap() {
    if (this.inline || this.cfg.API_ROLE === 'web') return;
    for (const [queue, reg] of this.regs) {
      const w = new Worker(
        queue,
        async (job) => {
          const h = reg.handlers.get(job.name);
          if (!h) throw new Error(`no handler ${queue}/${job.name}`);
          return h(job.data, job);
        },
        { connection: this.redis.duplicate(), concurrency: reg.concurrency },
      );
      w.on('failed', (job, err) => this.log.error(`${queue}/${job?.name} failed: ${err.message}`));
      this.workers.push(w);
    }
    this.log.log(`workers started: ${[...this.regs.keys()].join(', ')}`);
  }

  async onModuleDestroy() {
    await Promise.allSettled([...this.workers.map((w) => w.close()), ...[...this.queues.values()].map((q) => q.close()), ...[...this.events.values()].map((e) => e.close())]);
  }
}
