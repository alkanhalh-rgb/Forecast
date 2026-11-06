'use client';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';

const STATUSES = ['', 'DRAFT', 'REVIEW', 'LIVE', 'LOCKED', 'RESOLVED', 'FINAL', 'VOID'];

export default function AdminQuestions() {
  const { t, pick, dt, n } = useI18n();
  const [status, setStatus] = useState('REVIEW');
  const { data } = useSWR<any[]>(`/admin/questions${status ? `?status=${status}` : ''}`, fetcher);
  return (
    <div className="space-y-3">
      <label className="label" htmlFor="st">
        {t('admin.questions')}
      </label>
      <select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s ? t(`status.${s}`) : t('feed.all')}
          </option>
        ))}
      </select>
      {!data ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {data.map((q) => (
            <li key={q.id}>
              <Link href={`/admin/q/${q.id}`} className="card block hover:border-brand-600">
                <div className="mb-1 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">{t(`status.${q.status}`)}</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">{pick(q.category, 'name')}</span>
                  {q.resolution && !q.resolution.confirmedById && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-warn">{t('admin.confirmQueue')}</span>}
                  {q._count.disputes > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-bad">{t('admin.disputes')}: {n(q._count.disputes)}</span>}
                </div>
                <p className="font-medium">{pick(q, 'text')}</p>
                <p className="num text-sm text-muted">
                  {t('question.lockAt')}: {dt(q.lockAt)} · {t('feed.forecasters', { n: n(q._count.forecasts) })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
