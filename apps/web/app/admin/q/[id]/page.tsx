'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { ATTESTATIONS, VOID_REASONS } from '@app/shared';
import { QuestionEditor } from '@/components/admin/QuestionEditor';
import { ErrorText, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import type { Option } from '@/lib/types';

/** Runs an admin action and shows errors inline. */
function useAction(after: () => void) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return {
    error,
    busy,
    run: async (path: string, body: unknown) => {
      setBusy(true);
      setError(null);
      try {
        await api(path, { body: body ?? {} });
        after();
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
  };
}

export default function AdminQuestion() {
  const { id } = useParams<{ id: string }>();
  const { t, pick, dt } = useI18n();
  const { me } = useSession();
  const { data: q, mutate } = useSWR<any>(`/admin/questions/${id}`, fetcher);
  const { data: audit, mutate: mutateAudit } = useSWR<any[]>(`/admin/audit?entityId=${id}`, fetcher);
  const refresh = () => {
    mutate();
    mutateAudit();
  };
  const act = useAction(refresh);
  const [attest, setAttest] = useState<Record<string, boolean>>({});
  const [winner, setWinner] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [voidReason, setVoidReason] = useState<string>(VOID_REASONS[0]);
  const [note, setNote] = useState('');

  if (!q) return <Spinner />;
  const opts = q.options as Option[];
  const optLabel = (oid: string) => pick(opts.find((o) => o.id === oid) ?? {}, 'label');
  const role = me?.role;
  const canEdit = role === 'EDITOR' || role === 'ADMIN';
  const canReview = role === 'REVIEWER' || role === 'ADMIN';
  const r = q.resolution;

  const checklist = (
    <fieldset className="space-y-2">
      <legend className="label">{t('admin.checklist')}</legend>
      <p className="text-sm font-medium">{t('admin.autoChecks')}</p>
      <ul className="space-y-1 text-sm">
        {Object.entries(q.autoChecks as Record<string, boolean>).map(([k, ok]) => (
          <li key={k} className={ok ? 'text-good' : 'text-bad'}>
            <span aria-hidden>{ok ? '✓' : '✗'}</span> {t(`checklist.${k}`)}
          </li>
        ))}
      </ul>
      <p className="pt-2 text-sm font-medium">{t('admin.attestations')}</p>
      {ATTESTATIONS.map((a) => (
        <label key={a} className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-brand-600" checked={!!attest[a]} onChange={(e) => setAttest({ ...attest, [a]: e.target.checked })} />
          <span>{t(`checklist.${a}`)}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="space-y-4">
      <section className="card space-y-1">
        <p className="text-sm">
          <span className="rounded-full bg-track px-2 py-0.5 font-medium">{t(`status.${q.status}`)}</span>
        </p>
        <h2 className="text-lg font-bold">{q.textAr}</h2>
        <p dir="ltr" lang="en" className="text-start">
          {q.textEn}
        </p>
        <ul className="list-inside list-disc text-sm">
          {opts.map((o) => (
            <li key={o.id}>
              {o.labelAr} / <span lang="en">{o.labelEn}</span>
            </li>
          ))}
        </ul>
        <p className="num text-sm text-muted">
          {t('question.lockAt')}: {dt(q.lockAt)} · {t('question.resolveBy')}: {dt(q.resolveBy)}
        </p>
        <p className="text-sm">
          {t('question.source')}:{' '}
          <a className="text-brand-700 underline" href={q.sourceUrl} target="_blank" rel="noopener noreferrer">
            {q.sourceName}
          </a>
        </p>
        <p className="text-sm text-muted">
          {q.createdBy?.nickname && <>✎ {q.createdBy.nickname} </>}
          {q.reviewedBy?.nickname && <>· ✓ {q.reviewedBy.nickname}</>}
        </p>
      </section>

      {q.status === 'DRAFT' && canEdit && (
        <>
          <QuestionEditor key={q.updatedAt} id={q.id} initial={{ ...q, options: opts }} onSaved={refresh} />
          <section className="card space-y-3">
            {checklist}
            <button className="btn-primary w-full" disabled={act.busy} onClick={() => act.run(`/admin/questions/${id}/submit`, attest)}>
              {t('admin.submitReview')}
            </button>
          </section>
        </>
      )}

      {q.status === 'REVIEW' && canReview && (
        <section className="card space-y-3">
          {q.createdBy?.id === me?.id && <p className="text-sm text-warn">{t('admin.sameReviewer')}</p>}
          {checklist}
          <button className="btn-primary w-full" disabled={act.busy} onClick={() => act.run(`/admin/questions/${id}/approve`, attest)}>
            {t('admin.approve')}
          </button>
          <label className="label" htmlFor="rnote">
            {t('admin.decisionNote')}
          </label>
          <input id="rnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-secondary w-full" disabled={act.busy || note.length < 2} onClick={() => act.run(`/admin/questions/${id}/reject`, { note })}>
            {t('admin.reject')}
          </button>
        </section>
      )}

      {q.status === 'LOCKED' && !r && canEdit && (
        <section className="card space-y-3" aria-labelledby="res-h">
          <h3 id="res-h" className="font-bold">
            {t('admin.resolve')}
          </h3>
          <fieldset>
            <legend className="label">{t('admin.winningOption')}</legend>
            {opts.map((o) => (
              <label key={o.id} className="flex min-h-11 items-center gap-3">
                <input type="radio" name="winner" className="size-5 accent-brand-600" checked={winner === o.id} onChange={() => setWinner(o.id)} />
                {pick(o, 'label')}
              </label>
            ))}
          </fieldset>
          <label className="label" htmlFor="rurl">
            {t('admin.resolutionSource')}
          </label>
          <input id="rurl" className="input" dir="ltr" type="url" value={resUrl} onChange={(e) => setResUrl(e.target.value)} />
          <button className="btn-primary w-full" disabled={act.busy || !winner || !resUrl} onClick={() => act.run(`/admin/questions/${id}/resolve`, { winningOptionId: winner, sourceUrl: resUrl })}>
            {t('admin.resolve')}
          </button>
        </section>
      )}

      {q.status === 'LOCKED' && r && !r.confirmedById && (
        <section className="card space-y-3">
          <p className="font-medium">{t('admin.proposed', { option: optLabel(r.winningOptionId), who: r.resolvedByNickname ?? '' })}</p>
          <a className="text-sm text-brand-700 underline" href={r.sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr">
            {r.sourceUrl}
          </a>
          {r.resolvedById === me?.id ? (
            <p className="text-sm text-warn">{t('admin.differentConfirmer')}</p>
          ) : (
            <button className="btn-primary w-full" disabled={act.busy} onClick={() => act.run(`/admin/questions/${id}/confirm`, {})}>
              {t('admin.confirm')}
            </button>
          )}
        </section>
      )}

      {r?.resolvedAt && (
        <section className="card space-y-1">
          <p className="font-medium">{t('question.resolvedWith', { option: optLabel(r.winningOptionId) })}</p>
          {r.correctionNote && <p className="text-sm text-warn">{t('question.correction', { note: r.correctionNote })}</p>}
        </section>
      )}

      {['RESOLVED', 'FINAL'].includes(q.status) && role === 'ADMIN' && (
        <section className="card space-y-3" aria-labelledby="corr-h">
          <h3 id="corr-h" className="font-bold">
            {t('admin.correct')}
          </h3>
          <fieldset>
            <legend className="label">{t('admin.winningOption')}</legend>
            {opts.map((o) => (
              <label key={o.id} className="flex min-h-11 items-center gap-3">
                <input type="radio" name="cwinner" className="size-5 accent-brand-600" checked={winner === o.id} onChange={() => setWinner(o.id)} />
                {pick(o, 'label')}
              </label>
            ))}
          </fieldset>
          <label className="label" htmlFor="curl">
            {t('admin.resolutionSource')}
          </label>
          <input id="curl" className="input" dir="ltr" type="url" value={resUrl} onChange={(e) => setResUrl(e.target.value)} />
          <label className="label" htmlFor="cnote">
            {t('admin.correctionNote')}
          </label>
          <textarea id="cnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full" disabled={act.busy || !winner || !resUrl || note.length < 5} onClick={() => act.run(`/admin/questions/${id}/correct`, { winningOptionId: winner, sourceUrl: resUrl, correctionNote: note })}>
            {t('admin.correct')}
          </button>
        </section>
      )}

      {['LIVE', 'LOCKED', 'RESOLVED'].concat(role === 'ADMIN' ? ['FINAL'] : []).includes(q.status) && canEdit && (
        <section className="card space-y-3" aria-labelledby="void-h">
          <h3 id="void-h" className="font-bold">
            {t('admin.void')}
          </h3>
          <label className="label" htmlFor="vr">
            {t('admin.voidReason')}
          </label>
          <select id="vr" className="input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}>
            {VOID_REASONS.map((v) => (
              <option key={v} value={v}>
                {t(`voidReason.${v}`)}
              </option>
            ))}
          </select>
          <button className="btn-danger w-full" disabled={act.busy} onClick={() => act.run(`/admin/questions/${id}/void`, { reason: voidReason })}>
            {t('admin.void')}
          </button>
        </section>
      )}

      <ErrorText error={act.error} />

      <section className="card" aria-labelledby="aud-h">
        <h3 id="aud-h" className="mb-2 font-bold">
          {t('admin.audit')}
        </h3>
        <ol className="space-y-1 text-sm">
          {audit?.map((a) => (
            <li key={a.id} className="num">
              <span className="text-muted">{dt(a.createdAt)}</span> · <code>{a.action}</code>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
