import { Body, Controller, Delete, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { User } from '@app/db';
import { AllowIncomplete, CurrentUser, RateLimit } from '../common/decorators';
import { SESSION_COOKIE } from '../common/session';
import { parse } from '../common/zod';
import { PrivacyService } from './privacy.service';

@Controller('me')
export class PrivacyController {
  constructor(private privacy: PrivacyService) {}

  @AllowIncomplete()
  @Get('export')
  @RateLimit({ name: 'export', limit: 5, windowSec: 3600 })
  async export(@CurrentUser() u: User, @Res({ passthrough: true }) res: Response) {
    res.setHeader('content-disposition', `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`);
    return this.privacy.export(u);
  }

  @AllowIncomplete()
  @Delete()
  async remove(@CurrentUser() u: User, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { confirmNickname } = parse(z.object({ confirmNickname: z.string() }), body);
    const out = await this.privacy.delete(u, confirmNickname);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return out;
  }
}
