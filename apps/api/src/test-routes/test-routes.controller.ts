import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { normalizeSaudiPhone } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { Public } from '../common/decorators';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { ConsoleSmsProvider } from '../auth/sms/console.provider';
import { SMS_PROVIDER } from '../auth/sms/sms.provider';
import { SweeperService } from '../jobs/sweeper.service';
import { encryptPhone, hashPhone } from '../common/crypto';
import { signSession } from '../common/session';
import { randomInt } from 'node:crypto';

/**
 * Helpers for automated end-to-end tests. Only mounted when ENABLE_TEST_ROUTES=true and
 * NODE_ENV !== production (see TestRoutesModule.register).
 */
@Controller('test')
export class TestRoutesController {
  constructor(
    private clock: ClockService,
    private prisma: PrismaService,
    private sweeper: SweeperService,
    @Inject(SMS_PROVIDER) private sms: ConsoleSmsProvider,
  ) {}

  @Public()
  @Get('last-code')
  lastCode(@Query('phone') phone: string) {
    const e164 = normalizeSaudiPhone(phone ?? '');
    const code = e164 ? this.sms.last.get(e164) : undefined;
    if (!code) throw notFound();
    return { code };
  }

  @Public()
  @Post('clock')
  @HttpCode(200)
  setClock(@Body() body: { offsetMs?: number; advanceMs?: number }) {
    if (typeof body.advanceMs === 'number') this.clock.advance(body.advanceMs);
    else this.clock.setOffset(body.offsetMs ?? 0);
    return { now: this.clock.now(), offsetMs: this.clock.getOffset() };
  }

  /** Runs all periodic jobs right now (lock, finalize, duel expiry, notifications, league rollover). */
  @Public()
  @Post('tick')
  @HttpCode(200)
  async tick() {
    return this.sweeper.runAll();
  }

  /** Creates an onboarded user directly (supporting actors in e2e tests) and returns a session token. */
  @Public()
  @Post('users')
  async createUser(@Body() body: { nickname: string; role?: 'USER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' }) {
    const phone = `+9665${String(randomInt(0, 99_999_999)).padStart(8, '0')}`;
    const at = this.clock.now();
    const u = await this.prisma.user.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), nickname: body.nickname, city: 'riyadh', interests: ['spl', 'oil', 'tech'], role: body.role ?? 'USER', ageConfirmedAt: at, onboardedAt: at, consentLog: [{ type: 'AGE_18_PLUS', at }] },
    });
    return { id: u.id, token: await signSession(u.id) };
  }

  @Public()
  @Post('role')
  @HttpCode(200)
  async role(@Body() body: { nickname: string; role: 'USER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' }) {
    const u = await this.prisma.user.update({ where: { nickname: body.nickname }, data: { role: body.role } });
    return { id: u.id, role: u.role };
  }
}
