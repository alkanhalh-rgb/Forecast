import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { testEnv } from './test-env';

/** Creates/migrates the dedicated test database once per run. */
export default async function setup() {
  const env = testEnv();
  const base = new URL(env.DATABASE_URL);
  const dbName = base.pathname.slice(1);
  const admin = new URL(env.DATABASE_URL);
  admin.pathname = '/postgres';
  const { PrismaClient } = await import('@app/db');
  const p = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  const rows = await p.$queryRawUnsafe<{ n: number }[]>(`SELECT 1 as n FROM pg_database WHERE datname = '${dbName}'`);
  if (rows.length === 0) await p.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await p.$disconnect();
  execSync('pnpm exec prisma migrate deploy', { cwd: resolve(__dirname, '../../../packages/db'), env: { ...process.env, DATABASE_URL: env.DATABASE_URL }, stdio: 'pipe' });
}
