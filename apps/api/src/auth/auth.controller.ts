import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { phoneSchema, verifySchema } from '@app/shared';
import { loadConfig } from '../config';
import { Public } from '../common/decorators';
import { SESSION_COOKIE, SESSION_DAYS } from '../common/session';
import { parse } from '../common/zod';
import { AuthService } from './auth.service';
import { publicMe } from '../users/me.mapper';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('request-code')
  @HttpCode(200)
  requestCode(@Body() body: unknown, @Req() req: Request) {
    const { phone } = parse(phoneSchema, body);
    const locale = req.cookies?.locale === 'en' ? 'en' : 'ar';
    return this.auth.requestCode(phone, req.ip ?? 'unknown', locale);
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { phone, code } = parse(verifySchema, body);
    const { token, user } = await this.auth.verifyCode(phone, code);
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: loadConfig().COOKIE_SECURE, maxAge: SESSION_DAYS * 86400_000, path: '/' });
    return { token, me: publicMe(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }
}
