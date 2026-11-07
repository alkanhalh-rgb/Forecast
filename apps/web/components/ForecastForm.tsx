'use client';
import { useState } from 'react';
import { CONFIDENCE_LEVELS, forecastScore } from '@app/shared';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import type { QuestionDto } from '@/lib/types';
import { OPTION_COLORS } from './QuestionCard';
import { ErrorText } from './ui';

/**
 * Answer tiles + confidence switch (60/75/90) + score preview widgets.
 * The server decides whether the forecast is still accepted.
 */
export function ForecastForm({ q, onSaved, initialPick }: { q: QuestionDto; onSaved?: (res: any) => void; initialPick?: string }) {
  const { t, pick, signed, n } = useI18n();
  const valid = (id?: string | null) => (id && q.options.some((o) => o.id === id) ? id : '');
  const [optionId, setOptionId] = useState(valid(q.myForecast?.optionId) || valid(initialPick));
  const [confidence, setConfidence] = useState<number>(q.myForecast?.confidence ?? 75);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const k = q.options.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const res = await api('/forecasts', { body: { questionId: q.id, optionId, confidence } });
      setNotice(res.status === 'queued' ? t('question.queued') : t('question.saved'));
      onSaved?.(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label={pick(q, 'text')}>
      <section className="card flex flex-col gap-3">
        <fieldset>
          <legend className="mb-3 text-base font-bold">{t('question.chooseOption')}</legend>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(k, 3)}, minmax(0, 1fr))` }}>
            {q.options.map((o, i) => {
              const on = optionId === o.id;
              return (
                <label
                  key={o.id}
                  className={`flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[18px] p-2 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue ${on ? 'border-2 border-brand-600 bg-brand-50 text-brand-700' : 'border border-line bg-soft'}`}
                >
                  <input type="radio" className="sr-only" name={`opt-${q.id}`} value={o.id} checked={on} onChange={() => setOptionId(o.id)} aria-label={pick(o, 'label')} />
                  <span aria-hidden className="flex size-[34px] items-center justify-center rounded-full text-sm font-bold" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length], color: i === 1 ? '#0f1f1a' : '#ffffff' }}>
                    {n(i + 1)}
                  </span>
                  <span className={`text-sm ${on ? 'font-bold' : 'font-semibold'}`}>{pick(o, 'label')}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="card flex flex-col gap-3">
        <fieldset>
          <legend className="mb-3 text-base font-bold">{t('question.chooseConfidence')}</legend>
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-canvas p-1.5">
            {CONFIDENCE_LEVELS.map((c) => (
              <label
                key={c}
                className={`chip min-h-[46px] cursor-pointer justify-center rounded-xl border-0 text-[15px] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue ${confidence === c ? 'bg-ink font-bold text-white' : 'bg-transparent text-ink'}`}
              >
                <input type="radio" className="sr-only" name={`conf-${q.id}`} value={c} checked={confidence === c} onChange={() => setConfidence(c)} />
                <span aria-hidden className="num">{n(c)}%</span>
                <span className="sr-only">{t('question.confidence', { n: `${c}%` })}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2" aria-live="polite">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-brand-50 p-3 text-brand-700">
            <span className="text-xs">{t('question.ifRight')}</span>
            <span className="text-[22px] font-bold">{signed(forecastScore(confidence, true, k))}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl bg-bad-50 p-3 text-bad">
            <span className="text-xs">{t('question.ifWrong')}</span>
            <span className="text-[22px] font-bold">{signed(forecastScore(confidence, false, k))}</span>
          </div>
        </div>
        <button className="btn-primary min-h-[54px] w-full text-[17px]" disabled={busy || !optionId}>
          {q.myForecast ? t('question.update') : t('question.submit')}
        </button>
        {notice && (
          <p role="status" className="text-center text-sm font-semibold text-good">
            {notice}
          </p>
        )}
        <ErrorText error={error} />
      </section>
    </form>
  );
}
