'use client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import useSWR from 'swr';
import { DisputeForm } from '@/components/DisputeForm';
import { ForecastForm } from '@/components/ForecastForm';
import { Icon } from '@/components/Icon';
import { categoryPill, OPTION_COLORS, useRelative } from '@/components/QuestionCard';
import { Bdi, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import { useCrowdLive } from '@/lib/socket';
import type { QuestionDto } from '@/lib/types';

export default function QuestionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Question />
    </Suspense>
  );
}

function Question() {
  const { id } = useParams<{ id: string }>();
  const initialPick = useSearchParams().get('pick') ?? undefined;
  const router = useRouter();
  const { t, pick, time, signed, n } = useI18n();
  const rel = useRelative();
  const { me } = useSession();
  const { data: q, mutate } = useSWR<QuestionDto>(`/questions/${id}`, fetcher);
  const [live, setLive] = useState<QuestionDto['crowd']>(null);
  const onCrowd = useCallback((c: NonNullable<QuestionDto['crowd']>) => setLive(c), []);
  useCrowdLive(id, !!q?.myForecast && q.status === 'LIVE', onCrowd);

  if (!q) return <Spinner />;
  const crowd = live ?? q.crowd;
  const open = q.status === 'LIVE' && new Date(q.lockAt).getTime() > Date.now();
  const opt = (oid: string) => q.options.find((o) => o.id === oid);
  const lockIn = rel(q.lockAt);

  return (
    <article className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push('/'))} aria-label={t('question.back')} className="flex size-11 items-center justify-center rounded-2xl border border-line bg-surface">
          <Icon name="back" className="ltr:-scale-x-100" />
        </button>
        <span className="text-[15px] font-semibold">{t('question.title')}</span>
        <button
          type="button"
          aria-label={t('question.share')}
          className="flex size-11 items-center justify-center rounded-2xl border border-line bg-surface"
          onClick={() => (navigator.share ? navigator.share({ title: pick(q, 'text'), url: location.href }).catch(() => undefined) : navigator.clipboard?.writeText(location.href))}
        >
          <Icon name="share" />
        </button>
      </div>

      <header className="flex flex-col gap-3.5 rounded-3xl bg-brand-600 p-5 text-white">
        <div className="flex flex-wrap gap-2">
          <span className={`pill bg-white ${categoryPill(q.category.slug).split(' ').find((c) => c.startsWith('text-')) ?? 'text-brand-700'}`}>{pick(q.category, 'name')}</span>
          <span className="pill bg-brand-700 text-white">{t(`status.${q.status}`)}</span>
        </div>
        <h1 className="text-2xl font-bold leading-snug">{pick(q, 'text')}</h1>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-brand-700 p-3">
            <span className="text-xs text-brand-100">{open && lockIn ? t('question.locksInLabel') : t('question.lockAt')}</span>
            <span className="text-xl font-bold">{open && lockIn ? lockIn : <Bdi>{time(q.lockAt)}</Bdi>}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl bg-brand-700 p-3">
            <span className="text-xs text-brand-100">{t('question.resolveBy')}</span>
            <span className="text-xl font-bold">
              <Bdi>{time(q.resolveBy)}</Bdi>
            </span>
          </div>
        </div>
      </header>

      {q.status === 'VOID' && <p className="card text-warn">{t('question.voided', { reason: t(`voidReason.${q.voidReason}`) })}</p>}

      {q.resolution && (
        <section className="card flex flex-col gap-2" aria-live="polite">
          <p className="text-lg font-bold">{t('question.resolvedWith', { option: pick(opt(q.resolution.winningOptionId) ?? {}, 'label') })}</p>
          {q.myScore && (
            <p className={`rounded-2xl p-3 text-xl font-bold ${q.myScore.points >= 0 ? 'bg-brand-50 text-good' : 'bg-bad-50 text-bad'}`}>{t('question.yourScore', { points: signed(q.myScore.points) })}</p>
          )}
          {q.resolution.correctionNote && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-warn">{t('question.correction', { note: q.resolution.correctionNote })}</p>}
          {q.disputeUntil && me && q.myForecast && !q.myDispute && <DisputeForm questionId={q.id} until={q.disputeUntil} onSent={() => mutate()} />}
          {q.myDispute && <p className="text-sm text-muted">{t('question.reportSent')}</p>}
        </section>
      )}

      {q.myForecast && (
        <p className="card flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Icon name="check" size={16} strokeWidth={2.6} />
          </span>
          {t('question.yourForecast', { option: pick(opt(q.myForecast.optionId) ?? {}, 'label'), n: `${q.myForecast.confidence}%` })}
        </p>
      )}

      {open && me && (
        <>
          <ForecastForm key={q.myForecast?.updatedAt ?? 'new'} q={q} initialPick={initialPick} onSaved={() => mutate()} />
          <p className="text-center text-xs text-muted">{t('question.changeUntil', { time: time(q.lockAt) })}</p>
        </>
      )}
      {open && !me && (
        <Link href={`/login?next=/q/${q.id}`} className="btn-primary w-full">
          {t('question.signInToForecast')}
        </Link>
      )}
      {!open && q.status !== 'VOID' && !q.resolution && <p className="card text-muted">{t('question.lockedNotice')}</p>}

      <section className="card flex flex-col gap-3" aria-labelledby="crowd-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="crowd-title" className="text-base font-bold">
            {t('question.crowd')}
          </h2>
          <span className="text-xs text-muted">
            {t('question.crowdTotal', { n: n(crowd?.total ?? q.forecasters ?? 0) })}
            {crowd && q.status === 'LIVE' ? ` · ${t('question.live')}` : ''}
          </span>
        </div>
        {crowd ? (
          <ul className="flex flex-col gap-2.5">
            {q.options.map((o, i) => {
              const pct = Math.round((crowd.shares[o.id] ?? 0) * 100);
              return (
                <li key={o.id} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[13px] font-semibold">
                    <span>{pick(o, 'label')}</span>
                    <Bdi>{n(pct)}%</Bdi>
                  </div>
                  <div className="h-2.5 rounded-full bg-track">
                    <div className="h-2.5 rounded-full transition-[inline-size]" style={{ inlineSize: `${pct}%`, background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('question.crowdHidden')}</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer" className="widget text-ink hover:bg-soft">
          <span className="text-brand-600">
            <Icon name="link" size={22} />
          </span>
          <span className="text-xs text-muted">{t('question.source')}</span>
          <span className="text-sm font-bold">{q.sourceName}</span>
        </a>
        {open && me ? (
          <Link href={`/duels/new?questionId=${q.id}`} className="flex flex-col gap-1.5 rounded-[22px] bg-blue p-4 text-white hover:opacity-95">
            <Icon name="duel" size={22} />
            <span className="text-xs text-[#dce5fa]">{t('question.challengeFree')}</span>
            <span className="text-sm font-bold">{t('question.challengeShort')}</span>
          </Link>
        ) : (
          <Link href="/leaderboards" className="widget text-ink hover:bg-soft">
            <span className="text-brand-600">
              <Icon name="rankings" size={22} />
            </span>
            <span className="text-xs text-muted">{t('nav.leaderboards')}</span>
            <span className="text-sm font-bold">{t('leaderboards.title')}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
