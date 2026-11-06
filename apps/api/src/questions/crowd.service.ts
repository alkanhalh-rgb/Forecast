import { Injectable } from '@nestjs/common';
import { crowdShares } from '@app/shared';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { questionRoom } from '../realtime/realtime.gateway';
import { RealtimeService } from '../realtime/realtime.service';

const key = (qid: string) => `crowd:${qid}`;

/** Crowd counters live in Redis hashes (optionId -> count); they are never recomputed per request. */
@Injectable()
export class CrowdService {
  constructor(private redis: RedisService, private prisma: PrismaService, private rt: RealtimeService) {}

  async counts(questionId: string): Promise<Record<string, number>> {
    const exists = await this.redis.client.exists(key(questionId));
    if (!exists) return this.rebuild(questionId);
    const raw = await this.redis.client.hgetall(key(questionId));
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) if (k !== '_init') out[k] = Number(v);
    return out;
  }

  async get(questionId: string, optionIds: string[]) {
    return crowdShares(await this.counts(questionId), optionIds);
  }

  async total(questionId: string): Promise<number> {
    const c = await this.counts(questionId);
    return Object.values(c).reduce((a, b) => a + b, 0);
  }

  /** Applies a forecast change: -1 on the previous option, +1 on the new one. */
  async apply(questionId: string, optionIds: string[], prev: string | null, next: string | null) {
    if (prev === next) return;
    // Called after the DB commit. If the counter does not exist yet, building it from the DB
    // already includes this change, so no increment is applied.
    if (!(await this.redis.client.exists(key(questionId)))) await this.rebuild(questionId);
    else {
      const m = this.redis.client.multi();
      if (prev) m.hincrby(key(questionId), prev, -1);
      if (next) m.hincrby(key(questionId), next, 1);
      await m.exec();
    }
    await this.rt.publish(questionRoom(questionId), 'crowd', { questionId, ...(await this.get(questionId, optionIds)) });
  }

  /** Rebuilds the counter from the database (startup, or if Redis lost the key). */
  async rebuild(questionId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.forecast.groupBy({ by: ['optionId'], where: { questionId }, _count: { _all: true } });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.optionId] = r._count._all;
    const m = this.redis.client.multi().del(key(questionId)).hset(key(questionId), '_init', 1);
    for (const [k, v] of Object.entries(counts)) m.hset(key(questionId), k, v);
    await m.exec();
    return counts;
  }

  /** Stores the final crowd distribution on the question (at lock time). */
  async snapshot(questionId: string) {
    const counts = await this.rebuild(questionId);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    await this.prisma.question.update({ where: { id: questionId }, data: { crowdSnapshot: { total, counts } } });
    return { total, counts };
  }

  async drop(questionId: string) {
    await this.redis.client.del(key(questionId));
  }
}
