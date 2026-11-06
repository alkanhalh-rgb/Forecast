import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalizeSaudiPhone } from '@app/shared';
import { AppError } from '../common/errors';
import { encryptPhone, hashPhone, otpCode, safeEqual, sha256 } from '../common/crypto';
import { PrismaService } from '../common/prisma.service';
import { RateLimitService } from '../common/rate-limit.service';
import { RedisService } from '../common/redis.service';
import { signSession } from '../common/session';
import { SMS_PROVIDER, SmsProvider } from './sms/sms.provider';

export const OTP_TTL_SEC = 5 * 60;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private rl: RateLimitService,
    @Inject(SMS_PROVIDER) private sms: SmsProvider,
  ) {}

  private normalize(phone: string): string {
    const e164 = normalizeSaudiPhone(phone);
    if (!e164) throw new AppError('INVALID_PHONE');
    return e164;
  }

  async requestCode(phone: string, ip: string, locale: 'ar' | 'en' = 'ar') {
    const e164 = this.normalize(phone);
    const h = hashPhone(e164);
    await this.rl.hit(`otp-ip:${ip}`, 20, 3600);
    await this.rl.hit(`otp:${h}`, OTP_MAX_REQUESTS_PER_HOUR, 3600);
    const code = otpCode();
    await this.redis.client.set(`otp:${h}`, JSON.stringify({ codeHash: sha256(`${h}:${code}`), attempts: 0 }), 'EX', OTP_TTL_SEC);
    await this.sms.sendCode(e164, code, locale);
    return { sent: true, expiresInSec: OTP_TTL_SEC };
  }

  async verifyCode(phone: string, code: string) {
    const e164 = this.normalize(phone);
    const h = hashPhone(e164);
    const key = `otp:${h}`;
    const raw = await this.redis.client.get(key);
    if (!raw) throw new AppError('CODE_EXPIRED', HttpStatus.BAD_REQUEST);
    const rec = JSON.parse(raw) as { codeHash: string; attempts: number };
    if (rec.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.client.del(key);
      throw new AppError('CODE_EXPIRED', HttpStatus.BAD_REQUEST);
    }
    if (!safeEqual(rec.codeHash, sha256(`${h}:${code}`))) {
      const ttl = await this.redis.client.ttl(key);
      await this.redis.client.set(key, JSON.stringify({ ...rec, attempts: rec.attempts + 1 }), 'EX', Math.max(ttl, 1));
      throw new AppError('CODE_INVALID', HttpStatus.BAD_REQUEST);
    }
    await this.redis.client.del(key);

    let user = await this.prisma.user.findUnique({ where: { phoneHash: h } });
    if (!user) user = await this.prisma.user.create({ data: { phoneHash: h, phoneEncrypted: encryptPhone(e164) } });
    const token = await signSession(user.id);
    return { token, user };
  }
}
