import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SMS_PROVIDER } from '../src/auth/sms/sms.provider';
import type { ConsoleSmsProvider } from '../src/auth/sms/console.provider';
import { createTestApp, resetState, seedCategories, TestCtx } from './helpers';

let ctx: TestCtx;
let sms: ConsoleSmsProvider;
beforeAll(async () => {
  ctx = await createTestApp();
  sms = ctx.app.get(SMS_PROVIDER);
});
afterAll(() => ctx.app.close());
beforeEach(async () => {
  await resetState(ctx);
  await seedCategories(ctx);
});

async function signIn(phone = '0551234567') {
  await ctx.http().post('/api/auth/request-code').send({ phone }).expect(200);
  const code = sms.last.get('+966551234567')!;
  const res = await ctx.http().post('/api/auth/verify').send({ phone, code }).expect(200);
  return { token: res.body.token as string, res };
}

describe('auth: phone + one-time code', () => {
  it('issues a session cookie and never returns the phone number', async () => {
    const { res } = await signIn();
    expect(res.headers['set-cookie']?.[0]).toMatch(/sid=.*HttpOnly/);
    expect(JSON.stringify(res.body)).not.toContain('551234567');
    const user = await ctx.prisma.user.findFirstOrThrow();
    expect(user.phoneEncrypted).not.toContain('551234567');
    expect(user.phoneHash).toHaveLength(64);
  });

  it('rejects a wrong code and an expired code', async () => {
    await ctx.http().post('/api/auth/request-code').send({ phone: '0551234567' }).expect(200);
    await ctx.http().post('/api/auth/verify').send({ phone: '0551234567', code: '000000' === sms.last.get('+966551234567') ? '111111' : '000000' }).expect(400);
    await ctx.redis.client.del((await ctx.redis.client.keys('otp:*')).find((k) => !k.startsWith('rl'))!);
    const res = await ctx.http().post('/api/auth/verify').send({ phone: '0551234567', code: sms.last.get('+966551234567') }).expect(400);
    expect(res.body.error.code).toBe('CODE_EXPIRED');
  });

  it('codes expire after 5 minutes', async () => {
    await ctx.http().post('/api/auth/request-code').send({ phone: '0551234567' }).expect(200);
    const keys = await ctx.redis.client.keys('otp:*');
    const ttl = await ctx.redis.client.ttl(keys[0]!);
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('allows at most 5 code requests per number per hour', async () => {
    for (let i = 0; i < 5; i++) await ctx.http().post('/api/auth/request-code').send({ phone: '0551234567' }).expect(200);
    const res = await ctx.http().post('/api/auth/request-code').send({ phone: '+966551234567' }).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('rejects non-Saudi numbers', async () => {
    const res = await ctx.http().post('/api/auth/request-code').send({ phone: '+14155550100' }).expect(400);
    expect(res.body.error.code).toBe('INVALID_PHONE');
  });
});

describe('onboarding', () => {
  it('requires 18+ confirmation before anything else, then nickname, interests', async () => {
    const { token } = await signIn();
    const auth = { Authorization: `Bearer ${token}` };
    // app features are blocked until onboarding
    await ctx.http().get('/api/health').expect(200);
    const blocked = await ctx.http().post('/api/me/profile').set(auth).send({ nickname: 'falcon', city: 'riyadh' }).expect(403);
    expect(blocked.body.error.code).toBe('AGE_CONFIRMATION_REQUIRED');
    await ctx.http().post('/api/me/age-consent').set(auth).send({ confirm18: false, acceptPrivacy: true }).expect(400);
    await ctx.http().post('/api/me/age-consent').set(auth).send({ confirm18: true, acceptPrivacy: true }).expect(200);
    await ctx.http().post('/api/me/profile').set(auth).send({ nickname: 'falcon', city: 'riyadh' }).expect(200);
    await ctx.http().post('/api/me/interests').set(auth).send({ interests: ['spl', 'oil'] }).expect(400);
    await ctx.http().post('/api/me/interests').set(auth).send({ interests: ['spl', 'oil', 'tech'] }).expect(200);
    const me = await ctx.http().post('/api/me/onboarding/complete').set(auth).expect(200);
    expect(me.body).toMatchObject({ nickname: 'falcon', ageConfirmed: true, onboarded: true, interests: ['spl', 'oil', 'tech'] });
    const user = await ctx.prisma.user.findFirstOrThrow();
    expect((user.consentLog as { type: string }[]).map((c) => c.type)).toEqual(['AGE_18_PLUS', 'PRIVACY_NOTICE']);
  });

  it('nicknames are unique (case-insensitive) and screened', async () => {
    const { token } = await signIn();
    const auth = { Authorization: `Bearer ${token}` };
    await ctx.http().post('/api/me/age-consent').set(auth).send({ confirm18: true, acceptPrivacy: true }).expect(200);
    await ctx.prisma.user.create({ data: { phoneHash: 'x', phoneEncrypted: 'x', nickname: 'Falcon' } });
    expect((await ctx.http().post('/api/me/profile').set(auth).send({ nickname: 'falcon', city: 'riyadh' }).expect(409)).body.error.code).toBe('NICKNAME_TAKEN');
    expect((await ctx.http().post('/api/me/profile').set(auth).send({ nickname: 'jackpot_king', city: 'riyadh' }).expect(400)).body.error.code).toBe('NICKNAME_NOT_ALLOWED');
  });
});
