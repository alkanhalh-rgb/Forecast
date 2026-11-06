'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import useSWR from 'swr';
import { ErrorText, PageTitle, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import type { QuestionDto } from '@/lib/types';

function NewDuel() {
  const { t, pick } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const { data: qs } = useSWR<QuestionDto[]>('/questions', fetcher);
  const [format, setFormat] = useState<'SINGLE' | 'BEST_OF_3'>('SINGLE');
  const [questionId, setQ] = useState(sp.get('questionId') ?? '');
  const [optionId, setOpt] = useState('');
  const [opponent, setOpponent] = useState('');
  const [error, setError] = useState<unknown>(null);
  if (!qs) return <Spinner />;
  const q = qs.find((x) => x.id === questionId);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          const d = await api('/duels', { body: { format, questionId, optionId, opponentNickname: opponent.trim() || undefined } });
          router.push(`/duels/${d.id}`);
        } catch (err) {
          setError(err);
        }
      }}
    >
      <PageTitle>{t('duels.new')}</PageTitle>
      <p className="text-sm text-muted">{t('duels.intro')}</p>
      <fieldset className="card">
        <legend className="label">{t('duels.format')}</legend>
        <div className="flex gap-2">
          {(['SINGLE', 'BEST_OF_3'] as const).map((f) => (
            <label key={f} className={`chip cursor-pointer ${format === f ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>
              <input type="radio" className="sr-only" name="format" checked={format === f} onChange={() => setFormat(f)} />
              {t(`duels.${f}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="card space-y-3">
        <label className="label" htmlFor="dq">
          {t('duels.pickQuestion')}
        </label>
        <select id="dq" className="input" required value={questionId} onChange={(e) => { setQ(e.target.value); setOpt(''); }}>
          <option value="">—</option>
          {qs.map((x) => (
            <option key={x.id} value={x.id}>
              {pick(x, 'text')}
            </option>
          ))}
        </select>
        {q && (
          <fieldset>
            <legend className="label">{t('duels.pickAnswer')}</legend>
            {q.options.map((o) => (
              <label key={o.id} className="flex min-h-11 items-center gap-3">
                <input type="radio" name="dopt" className="size-5 accent-brand-600" checked={optionId === o.id} onChange={() => setOpt(o.id)} />
                {pick(o, 'label')}
              </label>
            ))}
          </fieldset>
        )}
        <label className="label" htmlFor="opp">
          {t('duels.opponent')}
        </label>
        <input id="opp" className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} aria-describedby="opp-hint" />
        <p id="opp-hint" className="text-sm text-muted">
          {t('duels.opponentHint')}
        </p>
      </div>
      <button className="btn-primary w-full" disabled={!questionId || !optionId}>
        {t('duels.create')}
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export default function NewDuelPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewDuel />
    </Suspense>
  );
}
