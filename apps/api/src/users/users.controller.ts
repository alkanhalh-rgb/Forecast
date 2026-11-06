import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { User } from '@app/db';
import { ageConsentSchema, identifierHasBannedWords, interestsSchema, profileSchema } from '@app/shared';
import { AllowIncomplete, CurrentUser } from '../common/decorators';
import { AppError, conflict } from '../common/errors';
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/zod';
import { publicMe } from './me.mapper';

export const PRIVACY_VERSION = '2026-11';

@Controller('me')
export class UsersController {
  constructor(private prisma: PrismaService, private clock: ClockService) {}

  @AllowIncomplete()
  @Get()
  me(@CurrentUser() user: User) {
    return publicMe(user);
  }

  /** Step 1: confirm 18+ (rule 7) and accept the privacy notice. Both are logged in consentLog. */
  @AllowIncomplete()
  @Post('age-consent')
  @HttpCode(200)
  async ageConsent(@CurrentUser() user: User, @Body() body: unknown) {
    parse(ageConsentSchema, body);
    const at = this.clock.now();
    const log = Array.isArray(user.consentLog) ? (user.consentLog as object[]) : [];
    const u = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ageConfirmedAt: user.ageConfirmedAt ?? at,
        consentLog: [...log, { type: 'AGE_18_PLUS', at: at.toISOString() }, { type: 'PRIVACY_NOTICE', version: PRIVACY_VERSION, at: at.toISOString() }],
      },
    });
    return publicMe(u);
  }

  /** Step 2: public nickname + city. */
  @AllowIncomplete()
  @Post('profile')
  @HttpCode(200)
  async profile(@CurrentUser() user: User, @Body() body: unknown) {
    if (!user.ageConfirmedAt) throw new AppError('AGE_CONFIRMATION_REQUIRED', 403);
    const { nickname, city } = parse(profileSchema, body);
    if (identifierHasBannedWords(nickname)) throw new AppError('NICKNAME_NOT_ALLOWED');
    const taken = await this.prisma.user.findFirst({ where: { nickname: { equals: nickname, mode: 'insensitive' }, NOT: { id: user.id } } });
    if (taken) throw conflict('NICKNAME_TAKEN');
    const u = await this.prisma.user.update({ where: { id: user.id }, data: { nickname, city } });
    return publicMe(u);
  }

  /** Step 3: exactly 3 interests (category slugs). */
  @AllowIncomplete()
  @Post('interests')
  @HttpCode(200)
  async interests(@CurrentUser() user: User, @Body() body: unknown) {
    const { interests } = parse(interestsSchema, body);
    const unique = [...new Set(interests)];
    const found = await this.prisma.category.count({ where: { slug: { in: unique } } });
    if (unique.length !== 3 || found !== 3) throw new AppError('INVALID_INTERESTS');
    const u = await this.prisma.user.update({ where: { id: user.id }, data: { interests: unique } });
    return publicMe(u);
  }

  /** Step 4 ends after the warm-up forecasts. */
  @AllowIncomplete()
  @Post('onboarding/complete')
  @HttpCode(200)
  async complete(@CurrentUser() user: User) {
    if (!user.ageConfirmedAt || !user.nickname || user.interests.length !== 3) throw new AppError('ONBOARDING_INCOMPLETE');
    const u = await this.prisma.user.update({ where: { id: user.id }, data: { onboardedAt: user.onboardedAt ?? this.clock.now() } });
    return publicMe(u);
  }
}
