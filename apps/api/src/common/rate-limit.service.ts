import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from './errors';
import { RedisService } from './redis.service';

/** Fixed-window counters in Redis, shared by every API instance. */
@Injectable()
export class RateLimitService {
  constructor(private redis: RedisService) {}

  async hit(key: string, limit: number, windowSec: number): Promise<void> {
    const k = `rl:${key}`;
    const n = await this.redis.client.incr(k);
    if (n === 1) await this.redis.client.expire(k, windowSec);
    if (n > limit) {
      const ttl = await this.redis.client.ttl(k);
      throw new AppError('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS, 'too many requests', { retryAfterSec: Math.max(ttl, 1) });
    }
  }
}
