import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { RedisService } from '../common/redis.service';

const CHANNEL = 'rt:events';

/**
 * Fan-out of realtime events through Redis pub/sub, so a worker process (or any API instance)
 * can publish and every instance holding sockets delivers to its clients.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private sub: Redis | null = null;
  private server: Server | null = null;

  constructor(private redis: RedisService) {}

  attach(server: Server) {
    this.server = server;
  }

  async onModuleInit() {
    this.sub = this.redis.duplicate();
    await this.sub.subscribe(CHANNEL);
    this.sub.on('message', (_ch, raw) => {
      const { room, event, data } = JSON.parse(raw);
      this.server?.to(room).emit(event, data);
    });
  }

  async publish(room: string, event: string, data: unknown) {
    await this.redis.client.publish(CHANNEL, JSON.stringify({ room, event, data }));
  }

  async onModuleDestroy() {
    await this.sub?.quit().catch(() => undefined);
  }
}
