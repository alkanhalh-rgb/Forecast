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
