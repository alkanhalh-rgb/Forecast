import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role, User } from '@app/db';

export const IS_PUBLIC = 'isPublic';
/** No session required. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_INCOMPLETE = 'allowIncomplete';
/** Session required but onboarding (18+, nickname) may be unfinished. */
export const AllowIncomplete = () => SetMetadata(ALLOW_INCOMPLETE, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
export const STAFF: Role[] = ['EDITOR', 'REVIEWER', 'ADMIN'];

export const RATE_LIMIT = 'rateLimit';
export interface RateLimitOpts {
  name: string;
  limit: number;
  windowSec: number;
}
/** Per-user (or per-IP when anonymous) fixed-window limit. */
export const RateLimit = (opts: RateLimitOpts) => SetMetadata(RATE_LIMIT, opts);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user);
