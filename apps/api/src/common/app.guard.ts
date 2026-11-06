import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@app/db';
import { ALLOW_INCOMPLETE, IS_PUBLIC, RATE_LIMIT, RateLimitOpts, ROLES } from './decorators';
import { AppError } from './errors';
import { PrismaService } from './prisma.service';
import { RateLimitService } from './rate-limit.service';
import { tokenFromRequest, verifySession } from './session';

/**
 * One global guard: session -> onboarding gate (18+, rule 7) -> roles -> rate limit.
 * The user row is reloaded on each request so role changes and deletions apply immediately.
 */
@Injectable()
export class AppGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService, private rl: RateLimitService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    const meta = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);

    const token = tokenFromRequest(req);
    const userId = token ? await verifySession(token) : null;
    if (userId) req.user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!meta<boolean>(IS_PUBLIC)) {
      if (!req.user) throw new AppError('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
      if (!meta<boolean>(ALLOW_INCOMPLETE) && (!req.user.ageConfirmedAt || !req.user.nickname)) throw new AppError('ONBOARDING_REQUIRED', HttpStatus.FORBIDDEN);
      const roles = meta<Role[]>(ROLES);
      if (roles?.length && !roles.includes(req.user.role)) throw new AppError('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const rl = meta<RateLimitOpts>(RATE_LIMIT);
    if (rl) {
      const who = req.user?.id ?? `ip:${req.ip}`;
      await this.rl.hit(`${rl.name}:${who}`, rl.limit, rl.windowSec);
    }
    return true;
  }
}
