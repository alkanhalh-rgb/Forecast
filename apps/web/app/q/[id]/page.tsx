'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { ForecastForm } from '@/components/ForecastForm';
import { DisputeForm } from '@/components/DisputeForm';
import { Bdi, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import { useCrowdLive } from '@/lib/socket';
import type { QuestionDto } from '@/lib/types';

export default function QuestionPage() {
  const { id } = useParams<{ id: string }>();
  const { t, pick, dt, signed, n } = useI18n();
  const { me } = useSession();
  const { data: q, mutate } = useSWR<QuestionDto>(`/questions/${id}`, fetcher);
  const [live, setLive] = useState<QuestionDto['crowd']>(null);
  const onCrowd = useCallback((c: NonNullable<QuestionDto['crowd']>) => setLive(c), []);
  useCrowdLive(id, !!q?.myForecast && q.status === 'LIVE', onCrowd);

  if (!q) return <Spinner />;
  const crowd = live ?? q.crowd;
  const open = q.status === 'LIVE' && new Date(q.lockAt).getTime() > Date.now();
  const opt = (oid: string) => q.options.find((o) => o.id === oid);

  return (
    <article className="space-y-4">
      <header className="card">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800">{pick(q.category, 'name')}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">{t(`status.${q.status}`)}</span>
        </div>
        <h1 className="mb-3 text-xl font-bold leading-snug">{pick(q, 'text')}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">{t('question.lockAt')}</dt>
          <dd className="num">{dt(q.lockAt)}</dd>
          <dt className="text-muted">{t('question.resolveBy')}</dt>
          <dd className="num">{dt(q.resolveBy)}</dd>
          <dt className="text-muted">{t('question.source')}</dt>
          <dd>
            <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">
              {q.sourceName}
            </a>
          </dd>
        </dl>
        <p className="mt-2 text-xs text-muted">{t('common.timesRiyadh')}</p>
      </header>

      {q.status === 'VOID' && <p className="card border-warn text-warn">{t('question.voided', { reason: t(`voidReason.${q.voidReason}`) })}</p>}

      {q.resolution && (
        <section className="card space-y-2" aria-live="polite">
          <p className="text-lg font-bold">{t('question.resolvedWith', { option: pick(opt(q.resolution.winningOptionId) ?? {}, 'label') })}</p>
          {q.myScore && (
            <p className={`text-lg font-bold ${q.myScore.points >= 0 ? 'text-good' : 'text-bad'}`}>
              {t('question.yourScore', { points: signed(q.myScore.points) })}
            </p>
          )}
          {q.resolution.correctionNote && <p className="rounded-lg bg-amber-50 p-2 text-sm text-warn">{t('question.correction', { note: q.resolution.correctionNote })}</p>}
          {q.disputeUntil && me && q.myForecast && !q.myDispute && <DisputeForm questionId={q.id} until={q.disputeUntil} onSent={() => mutate()} />}
          {q.myDispute && <p className="text-sm text-muted">{t('question.reportSent')}</p>}
        </section>
      )}

      {q.myForecast && (
        <p className="card font-medium">
          {t('question.yourForecast', { option: pick(opt(q.myForecast.optionId) ?? {}, 'label'), n: `${q.myForecast.confidence}%` })}
        </p>
      )}

      {open && me && (
        <section className="card" aria-labelledby="fc-title">
          <h2 id="fc-title" className="sr-only">
            {t('question.chooseOption')}
          </h2>
          <ForecastForm key={q.myForecast?.updatedAt ?? 'new'} q={q} onSaved={() => mutate()} />
          <p className="mt-3 text-xs text-muted">{t('question.changeUntil', { time: dt(q.lockAt) })}</p>
        </section>
      )}
      {open && !me && (
        <Link href={`/login?next=/q/${q.id}`} className="btn-primary w-full">
          {t('question.signInToForecast')}
        </Link>
      )}
      {!open && q.status !== 'VOID' && !q.resolution && <p className="card text-muted">{t('question.lockedNotice')}</p>}

      <section className="card" aria-labelledby="crowd-title">
        <h2 id="crowd-title" className="mb-3 font-bold">
          {t('question.crowd')}
        </h2>
        {crowd ? (
          <ul className="space-y-3">
            {q.options.map((o) => {
              const share = crowd.shares[o.id] ?? 0;
              const pct = Math.round(share * 100);
              return (
                <li key={o.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{pick(o, 'label')}</span>
                    <Bdi className="font-medium">{n(pct)}%</Bdi>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200" role="presentation">
                    <div className="h-3 rounded-full bg-brand-600 transition-[inline-size]" style={{ inlineSize: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
            <li className="text-sm text-muted">{t('question.crowdTotal', { n: n(crowd.total) })}</li>
          </ul>
        ) : (
          <p className="text-muted">
            {t('question.crowdHidden')} <span className="num">({t('question.crowdTotal', { n: n(q.forecasters ?? 0) })})</span>
          </p>
        )}
      </section>

      {open && me && (
        <Link href={`/duels/new?questionId=${q.id}`} className="btn-secondary w-full">
          {t('question.challenge')}
        </Link>
      )}
    </article>
  );
}
