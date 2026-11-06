'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-client';
import type { QuestionDto } from '@/lib/types';

export function useRelative() {
  const { t, n } = useI18n();
  return (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return null;
    const m = Math.round(ms / 60000);
    if (m < 60) return t('time.minutes', { n: n(m) });
    const h = Math.floor(m / 60);
    return t('time.hours', { n: n(h), m: n(m % 60) });
  };
}

export function QuestionCard({ q }: { q: QuestionDto }) {
  const { t, pick, time, n } = useI18n();
  const rel = useRelative()(q.lockAt);
  return (
    <li>
      <Link href={`/q/${q.id}`} className="card block hover:border-brand-600">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800">{pick(q.category, 'name')}</span>
          {q.myForecast && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-ink">✓ {t('feed.answered')}</span>}
        </div>
        <h2 className="mb-2 text-lg font-bold leading-snug">{pick(q, 'text')}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>{rel ? t('feed.locksIn', { time: rel }) : t('feed.locksAt', { time: time(q.lockAt) })}</span>
          <span className="num">{t('feed.forecasters', { n: n(q.forecasters ?? 0) })}</span>
        </div>
      </Link>
    </li>
  );
}
