/** Test settings derived from the developer .env: separate DB and Redis DB, inline queues. */
export function testEnv() {
  const db = new URL(process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/forecast');
  db.pathname = '/forecast_test';
  const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  redis.pathname = '/1';
  return {
    DATABASE_URL: db.toString(),
    REDIS_URL: redis.toString(),
    QUEUE_INLINE: 'true',
    ENABLE_TEST_ROUTES: 'true',
    NODE_ENV: 'test',
    API_ROLE: 'all',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
  };
}
