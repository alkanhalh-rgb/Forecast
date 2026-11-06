'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ErrorText, PageTitle, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { duelResultKey, type DuelDto, type DuelQ } from '@/lib/duel-types';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import type { QuestionDto } from '@/lib/types';

function OptionPicker({ q, value, onChange, disabledId, name }: { q: DuelQ['question']; value: string; onChange: (v: string) => void; disabledId?: string | null; name: string }) {
  const { pick } = useI18n();
  return (
    <div className="grid gap-2">
      {q.options.map((o) => (
        <label key={o.id} className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 ${o.id === disabledId ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${value === o.id ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
          <input type="radio" name={name} className="size-5 accent-brand-600" disabled={o.id === disabledId} checked={value === o.id} onChange={() => onChange(o.id)} />
          {pick(o, 'label')}
        </label>
      ))}
    </div>
  );
}

export default function DuelPage() {
  const { id } = useParams<{ id: string }>();
  const { t, pick, dt, signed, n } = useI18n();
  const { me } = useSession();
  const { data: d, mutate } = useSWR<DuelDto>(`/duels/${id}`, fetcher, { refreshInterval: 15000 });
  const { data: live } = useSWR<QuestionDto[]>(d?.format === 'BEST_OF_3' && d.status === 'PENDING' ? '/questions' : null, fetcher);
  const [opt, setOpt] = useState('');
  const [q2, setQ2] = useState('');
  const [q2opt, setQ2opt] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [link, setLink] = useState('');
  useEffect(() => setLink(`${window.location.origin}/duels/${id}`), [id]);

  if (!d) return <Spinner />;
  const optLabel = (q: DuelQ['question'], oid: string | null) => (oid === 'HIDDEN' ? t('duels.hiddenPick') : oid ? pick(q.options.find((o) => o.id === oid) ?? {}, 'label') : '—');
  const canAccept = d.status === 'PENDING' && me && d.mySide !== 'challenger' && (!d.directed || d.mySide === 'opponent' || !d.opponent);
  const rk = duelResultKey(d);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle>{t('duels.vs', { a: d.challenger.nickname, b: d.opponent?.nickname ?? '…' })}</PageTitle>
      <section className="card space-y-1">
        <p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm font-medium">{t(`duelStatus.${d.status}`)}</span> <span className="text-sm">{t(`duels.${d.format}`)}</span>
        </p>
        {d.status === 'PENDING' && <p className="num text-sm text-muted">{t('duels.expiresAt', { time: dt(d.expiresAt) })}</p>}
        {rk && (
          <p className="text-xl font-bold" role="status">
            {t(rk)}
          </p>
        )}
        {d.score && <p className="num">{t('duels.score', { a: n(d.score.challenger), b: n(d.score.opponent) })}</p>}
        {d.myEloDelta !== null && d.status === 'DONE' && <p className="text-sm">{t('me.duelRating')}: {signed(d.myEloDelta)}</p>}
        <p className="text-xs text-muted">{t('duels.ratingNote')}</p>
      </section>

      {d.status === 'PENDING' && d.mySide === 'challenger' && (
        <section className="card space-y-2">
          <label className="label" htmlFor="link">
            {t('duels.shareLink')}
          </label>
          <div className="flex gap-2">
            <input id="link" readOnly className="input" dir="ltr" value={link} />
            <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(link)}>
              {t('common.copy')}
            </button>
          </div>
        </section>
      )}

      {d.questions.map((dq) => (
        <section key={dq.order} className="card space-y-2" aria-labelledby={`dq-${dq.order}`}>
          <h2 id={`dq-${dq.order}`} className="text-sm font-medium text-muted">
            {t('duels.question', { n: dq.order })}
          </h2>
          <Link href={`/q/${dq.question.id}`} className="block font-bold underline-offset-2 hover:underline">
            {pick(dq.question, 'text')}
          </Link>
          <p className="text-sm">{t('duels.picked', { who: d.challenger.nickname, option: optLabel(dq.question, dq.challengerOptionId) })}</p>
          {d.opponent && <p className="text-sm">{t('duels.picked', { who: d.opponent.nickname, option: optLabel(dq.question, dq.opponentOptionId) })}</p>}
          {dq.winningOptionId && dq.winningOptionId !== 'VOID' && <p className="text-sm font-medium text-good">{t('question.resolvedWith', { option: optLabel(dq.question, dq.winningOptionId) })}</p>}
          {dq.winningOptionId === 'VOID' && <p className="text-sm text-warn">{t('status.VOID')}</p>}
          {d.status === 'ACTIVE' && d.format === 'BEST_OF_3' && dq.order > 1 && dq.question.status === 'LIVE' && (
            <>
              {dq.order === 2 && d.mySide === 'challenger' && !dq.challengerOptionId && (
                <AnswerBox dq={dq} disabledId={dq.opponentOptionId} value={answers[2] ?? ''} onChange={(v) => setAnswers({ ...answers, 2: v })} onSubmit={() => run(() => api(`/duels/${id}/answer`, { body: { order: 2, optionId: answers[2] } }))} />
              )}
              {dq.order === 3 && d.mySide && !dq[d.mySide === 'challenger' ? 'challengerOptionId' : 'opponentOptionId'] && (
                <AnswerBox dq={dq} value={answers[3] ?? ''} onChange={(v) => setAnswers({ ...answers, 3: v })} onSubmit={() => run(() => api(`/duels/${id}/answer`, { body: { order: 3, optionId: answers[3] } }))} />
              )}
            </>
          )}
        </section>
      ))}

      {d.status === 'PENDING' && !me && (
        <Link className="btn-primary w-full" href={`/login?next=/duels/${id}`}>
          {t('nav.login')}
        </Link>
      )}
      {canAccept && (
        <form
          className="card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/duels/${id}/accept`, { body: { optionId: opt, ...(d.format === 'BEST_OF_3' ? { q2QuestionId: q2, q2OptionId: q2opt } : {}) } }));
          }}
        >
          <p className="font-bold">{t('duels.accept')}</p>
          <p className="text-sm text-muted">{t('duels.mustDiffer')}</p>
          <OptionPicker name="acc" q={d.questions[0]!.question} value={opt} onChange={setOpt} disabledId={d.questions[0]!.challengerOptionId} />
          {d.format === 'BEST_OF_3' && (
            <>
              <label className="label" htmlFor="q2">
                {t('duels.pickQ2')}
              </label>
              <select id="q2" className="input" value={q2} onChange={(e) => { setQ2(e.target.value); setQ2opt(''); }}>
                <option value="">—</option>
                {live?.filter((x) => x.id !== d.questions[0]!.question.id).map((x) => (
                  <option key={x.id} value={x.id}>
                    {pick(x, 'text')}
                  </option>
                ))}
              </select>
              {live?.find((x) => x.id === q2) && <OptionPicker name="q2o" q={live.find((x) => x.id === q2)! as unknown as DuelQ['question']} value={q2opt} onChange={setQ2opt} />}
              <p className="text-sm text-muted">{t('duels.q3System')}</p>
            </>
          )}
          <button className="btn-primary w-full" disabled={!opt || (d.format === 'BEST_OF_3' && (!q2 || !q2opt))}>
            {t('duels.accept')}
          </button>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  );
}

function AnswerBox({ dq, value, onChange, onSubmit, disabledId }: { dq: DuelQ; value: string; onChange: (v: string) => void; onSubmit: () => void; disabledId?: string | null }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 border-t border-line pt-2">
      <p className="font-medium">{t('duels.yourTurn', { n: dq.order })}</p>
      {disabledId && <p className="text-sm text-muted">{t('duels.mustDiffer')}</p>}
      <OptionPicker name={`ans-${dq.order}`} q={dq.question} value={value} onChange={onChange} disabledId={disabledId} />
      <button type="button" className="btn-primary w-full" disabled={!value} onClick={onSubmit}>
        {t('common.submit')}
      </button>
    </div>
  );
}
