import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { normalizeSaudiPhone } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { Public } from '../common/decorators';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { ConsoleSmsProvider } from '../auth/sms/console.provider';
import { SMS_PROVIDER } from '../auth/sms/sms.provider';
import { SweeperService } from '../jobs/sweeper.service';

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

  @Public()
  @Post('role')
  @HttpCode(200)
  async role(@Body() body: { nickname: string; role: 'USER' | 'EDITOR' | 'REVIEWER' | 'ADMIN' }) {
    const u = await this.prisma.user.update({ where: { nickname: body.nickname }, data: { role: body.role } });
    return { id: u.id, role: u.role };
  }
}
