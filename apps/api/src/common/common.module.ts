import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ClockService } from './clock.service';
import { PrismaService } from './prisma.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, ClockService, AuditService, RateLimitService],
  exports: [PrismaService, RedisService, ClockService, AuditService, RateLimitService],
})
export class CommonModule {}
