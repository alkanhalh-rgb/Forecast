'use client';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { ErrorText, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';

export default function DisputesPage() {
  const { t, pick, dt } = useI18n();
  const { me } = useSession();
  const { data, mutate } = useSWR<any[]>('/admin/disputes?status=OPEN', fetcher);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const canDecide = me?.role === 'ADMIN' || me?.role === 'REVIEWER';
  if (!data) return <Spinner />;
  if (data.length === 0) return <p className="card text-muted">{t('common.none')}</p>;
  const decide = async (id: string, decision: 'UPHELD' | 'REJECTED') => {
    setError(null);
    try {
      await api(`/admin/disputes/${id}/decide`, { body: { decision, note: notes[id] ?? '' } });
      mutate();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <ul className="space-y-3">
      <ErrorText error={error} />
      {data.map((d) => (
        <li key={d.id} className="card space-y-2">
          <Link href={`/admin/q/${d.question.id}`} className="font-bold text-brand-700 underline">
            {pick(d.question, 'text')}
          </Link>
          <p className="text-sm text-muted">
            {d.user.nickname} · <span className="num">{dt(d.createdAt)}</span>
          </p>
          <p>{d.message}</p>
          <a href={d.evidenceUrl} className="text-sm text-brand-700 underline" target="_blank" rel="noopener noreferrer" dir="ltr">
            {d.evidenceUrl}
          </a>
          {canDecide && (
            <>
              <label className="label" htmlFor={`n-${d.id}`}>
                {t('admin.decisionNote')}
              </label>
              <input id={`n-${d.id}`} className="input" value={notes[d.id] ?? ''} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={(notes[d.id] ?? '').length < 2} onClick={() => decide(d.id, 'UPHELD')}>
                  {t('admin.uphold')}
                </button>
                <button className="btn-secondary flex-1" disabled={(notes[d.id] ?? '').length < 2} onClick={() => decide(d.id, 'REJECTED')}>
                  {t('admin.rejectDispute')}
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
