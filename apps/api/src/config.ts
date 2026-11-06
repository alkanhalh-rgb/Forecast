import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32),
  PHONE_PEPPER: z.string().min(32),
  PHONE_ENC_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  SMS_PROVIDER: z.enum(['console']).default('console'),
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().default('mailto:ops@example.com'),
  CHROMIUM_PATH: z.string().optional().default(''),
  ENABLE_TEST_ROUTES: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SEASON_ANCHOR: z.string().default('2026-01-04'),
  /** web = HTTP + sockets only, worker = queues only, all = both */
  API_ROLE: z.enum(['web', 'worker', 'all']).default('all'),
  /** run queue jobs inline (tests only) */
  QUEUE_INLINE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type AppConfig = z.infer<typeof schema> & { testRoutes: boolean };

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  // Test routes can never be enabled in production.
  cached = { ...parsed, testRoutes: parsed.ENABLE_TEST_ROUTES && parsed.NODE_ENV !== 'production' };
  return cached;
}

export function resetConfigCache() {
  cached = null;
}
