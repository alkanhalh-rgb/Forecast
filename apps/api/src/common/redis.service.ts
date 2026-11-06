import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';
import { loadConfig } from '../config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  private extra: Redis[] = [];

  constructor() {
    this.client = new IORedis(loadConfig().REDIS_URL, { maxRetriesPerRequest: 3 });
  }

  /** A new connection suitable for BullMQ / pub-sub (maxRetriesPerRequest must be null). */
  duplicate(): Redis {
    const c = new IORedis(loadConfig().REDIS_URL, { maxRetriesPerRequest: null });
    this.extra.push(c);
    return c;
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.client.quit(), ...this.extra.map((c) => c.quit())]);
  }
}
