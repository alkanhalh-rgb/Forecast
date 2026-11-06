import { type BrowserContext, expect, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
export const ATTEST = { lockBeforeOutcomePublic: true, notBlockedTopic: true, neutralWording: true, optionsExclusiveExhaustive: true };
export const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export async function call<T = any>(path: string, opts: { token?: string; body?: unknown; method?: string } = {}): Promise<T> {
  const r = await fetch(API + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${opts.method ?? 'GET'} ${path} -> ${r.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Creates an onboarded user through the test route (no OTP), returns its token. */
export async function makeUser(nickname: string, role?: 'EDITOR' | 'REVIEWER' | 'ADMIN') {
  return call<{ id: string; token: string }>('/test/users', { body: { nickname, role } });
}

export async function loginAs(context: BrowserContext, token: string) {
  const url = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  await context.addCookies([{ name: 'sid', value: token, domain: url.hostname, path: '/' }]);
}

export const resetClock = () => call('/test/clock', { body: { offsetMs: 0 } });
export const advanceClock = (ms: number) => call('/test/clock', { body: { advanceMs: ms } });

/** Creates and publishes a question through the real admin flow (editor + a different reviewer). */
export async function publishQuestion(editor: string, reviewer: string, opts: { textAr: string; textEn: string; lockInMin: number; resolveInMin: number; categorySlug?: string; options?: { labelAr: string; labelEn: string }[] }) {
  const cats = await call<{ id: string; slug: string }[]>('/categories');
  const now = Date.now();
  const q = await call('/admin/questions', {
    token: editor,
    body: {
      categoryId: cats.find((c) => c.slug === (opts.categorySlug ?? 'tadawul'))!.id,
      textAr: opts.textAr,
      textEn: opts.textEn,
      options: opts.options ?? [
        { labelAr: 'نعم', labelEn: 'Yes' },
        { labelAr: 'لا', labelEn: 'No' },
      ],
      lockAt: new Date(now + opts.lockInMin * 60_000).toISOString(),
      resolveBy: new Date(now + opts.resolveInMin * 60_000).toISOString(),
      sourceName: 'Saudi Exchange (Tadawul)',
      sourceUrl: 'https://www.saudiexchange.sa/',
    },
  });
  await call(`/admin/questions/${q.id}/submit`, { token: editor, body: ATTEST });
  await call(`/admin/questions/${q.id}/approve`, { token: reviewer, body: ATTEST });
  return q as { id: string; options: { id: string; labelAr: string; labelEn: string }[] };
}

export async function expectNoServerError(page: Page) {
  await expect(page.locator('[role=alert]')).toHaveCount(0);
}
