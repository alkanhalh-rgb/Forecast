import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DomainEvents } from './events.service';
import { ClockService } from './clock.service';
import { PrismaService } from './prisma.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, ClockService, AuditService, RateLimitService, DomainEvents],
  exports: [PrismaService, RedisService, ClockService, AuditService, RateLimitService, DomainEvents],
})
export class CommonModule {}
