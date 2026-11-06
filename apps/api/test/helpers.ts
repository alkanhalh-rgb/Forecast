import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Role } from '@app/db';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ClockService } from '../src/common/clock.service';
import { encryptPhone, hashPhone } from '../src/common/crypto';
import { PrismaService } from '../src/common/prisma.service';
import { RedisService } from '../src/common/redis.service';
import { signSession } from '../src/common/session';

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
  redis: RedisService;
  clock: ClockService;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestCtx> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
    clock: app.get(ClockService),
    http: () => request(app.getHttpServer()),
  };
}

export async function resetState(ctx: TestCtx) {
  const tables = await ctx.prisma.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
  await ctx.prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  await ctx.redis.client.flushdb();
  ctx.clock.setOffset(0);
}

let phoneSeq = 100000;
/** Creates an onboarded user directly and returns it with a bearer token. */
export async function makeUser(ctx: TestCtx, opts: { nickname?: string; role?: Role; onboarded?: boolean } = {}) {
  const phone = `+9665${String(phoneSeq++).padStart(8, '0')}`;
  const nick = opts.nickname ?? `user${phoneSeq}`;
  const onboarded = opts.onboarded ?? true;
  const user = await ctx.prisma.user.create({
    data: {
      phoneHash: hashPhone(phone),
      phoneEncrypted: encryptPhone(phone),
      nickname: onboarded ? nick : null,
      city: 'riyadh',
      role: opts.role ?? 'USER',
      ageConfirmedAt: onboarded ? new Date() : null,
      onboardedAt: onboarded ? new Date() : null,
    },
  });
  const token = await signSession(user.id);
  return { user, token, auth: { Authorization: `Bearer ${token}` }, phone };
}

export async function seedCategories(ctx: TestCtx) {
  const cats = [
    ['spl', 'دوري روشن', 'Saudi Pro League'],
    ['tadawul', 'تداول', 'Tadawul'],
    ['oil', 'النفط', 'Oil'],
    ['weather', 'الطقس', 'Weather'],
    ['events', 'فعاليات', 'Events'],
    ['tech', 'تقنية', 'Tech'],
  ];
  for (const [slug, nameAr, nameEn] of cats) await ctx.prisma.category.create({ data: { slug: slug!, nameAr: nameAr!, nameEn: nameEn! } });
  return ctx.prisma.category.findMany();
}

/** Inserts a LIVE question directly (bypassing the admin flow) for tests. */
export async function makeLiveQuestion(
  ctx: TestCtx,
  opts: { lockInMs?: number; resolveInMs?: number; options?: number; categorySlug?: string; status?: 'LIVE' | 'LOCKED' } = {},
) {
  const now = ctx.clock.now().getTime();
  const cat = (await ctx.prisma.category.findUnique({ where: { slug: opts.categorySlug ?? 'tadawul' } })) ?? (await ctx.prisma.category.findFirstOrThrow());
  const n = opts.options ?? 2;
  const labels = n === 2 ? [['نعم', 'Yes'], ['لا', 'No']] : Array.from({ length: n }, (_, i) => [`خيار ${i + 1}`, `Option ${i + 1}`]);
  return ctx.prisma.question.create({
    data: {
      categoryId: cat.id,
      textAr: 'هل سيغلق مؤشر تاسي على ارتفاع اليوم؟',
      textEn: 'Will TASI close higher today?',
      options: labels.map(([ar, en], i) => ({ id: `opt${i}`, labelAr: ar!, labelEn: en! })),
      lockAt: new Date(now + (opts.lockInMs ?? 3600_000)),
      resolveBy: new Date(now + (opts.resolveInMs ?? 6 * 3600_000)),
      sourceName: 'Saudi Exchange',
      sourceUrl: 'https://www.saudiexchange.sa/',
      status: opts.status ?? 'LIVE',
      publishedAt: new Date(now),
    },
    include: { category: true },
  });
}

/** Locks (by moving the clock past lockAt), proposes and confirms an outcome through the API. */
export async function resolveViaApi(ctx: TestCtx, questionId: string, winningOptionId: string, editorAuth: Record<string, string>, confirmerAuth: Record<string, string>) {
  const q = await ctx.prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  const now = ctx.clock.now().getTime();
  if (q.lockAt.getTime() > now) ctx.clock.advance(q.lockAt.getTime() - now + 1000);
  await ctx.http().post(`/api/admin/questions/${questionId}/resolve`).set(editorAuth).send({ winningOptionId, sourceUrl: 'https://www.saudiexchange.sa/result' }).expect(200);
  return ctx.http().post(`/api/admin/questions/${questionId}/confirm`).set(confirmerAuth).send({}).expect(200);
}
