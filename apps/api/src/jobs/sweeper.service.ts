import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { QueueService, QUEUES } from './queue.service';

export type SweepFn = () => Promise<unknown>;

/**
 * Periodic safety-net jobs. Feature modules register sweepers (e.g. "lock due questions").
 * BullMQ runs them every 15s; tests and e2e can run them on demand via runAll().
 */
@Injectable()
export class SweeperService implements OnModuleInit, OnApplicationBootstrap {
  private log = new Logger('Sweeper');
  private sweepers = new Map<string, SweepFn>();

  constructor(private queues: QueueService) {}

  register(name: string, fn: SweepFn) {
    this.sweepers.set(name, fn);
  }

  async runAll() {
    const out: Record<string, unknown> = {};
    for (const [name, fn] of this.sweepers) {
      try {
        out[name] = await fn();
      } catch (e) {
        this.log.error(`${name}: ${(e as Error).message}`);
        out[name] = { error: (e as Error).message };
      }
    }
    return out;
  }

  onModuleInit() {
    this.queues.register(QUEUES.questions, 'sweep', () => this.runAll(), 1);
  }

  async onApplicationBootstrap() {
    await this.queues.addRepeatable(QUEUES.questions, 'sweep', { every: 15_000 });
  }
}
