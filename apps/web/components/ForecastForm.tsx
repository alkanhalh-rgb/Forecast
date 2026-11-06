'use client';
import { useState } from 'react';
import { CONFIDENCE_LEVELS, forecastScore } from '@app/shared';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import type { QuestionDto } from '@/lib/types';
import { ErrorText } from './ui';

/** Option picker + confidence chips (60/75/90). The server decides whether the forecast is still accepted. */
export function ForecastForm({ q, onSaved }: { q: QuestionDto; onSaved?: (res: any) => void }) {
  const { t, pick, signed } = useI18n();
  const [optionId, setOptionId] = useState(q.myForecast?.optionId ?? '');
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
    <form onSubmit={submit} className="space-y-4" aria-label={pick(q, 'text')}>
      <fieldset>
        <legend className="label">{t('question.chooseOption')}</legend>
        <div className="grid gap-2">
          {q.options.map((o) => (
            <label key={o.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${optionId === o.id ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
              <input type="radio" name={`opt-${q.id}`} value={o.id} checked={optionId === o.id} onChange={() => setOptionId(o.id)} className="size-5 accent-brand-600" />
              <span>{pick(o, 'label')}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">{t('question.chooseConfidence')}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {CONFIDENCE_LEVELS.map((c) => (
            <label key={c} className={`chip cursor-pointer ${confidence === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink'}`}>
              <input type="radio" className="sr-only" name={`conf-${q.id}`} value={c} checked={confidence === c} onChange={() => setConfidence(c)} />
              <span className="num">{t('question.confidence', { n: c })}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          {t('question.scorePreview', { win: signed(forecastScore(confidence, true, k)), lose: signed(forecastScore(confidence, false, k)) })}
        </p>
      </fieldset>
      <button className="btn-primary w-full" disabled={busy || !optionId}>
        {q.myForecast ? t('question.update') : t('question.submit')}
      </button>
      {notice && (
        <p role="status" className="text-sm font-medium text-good">
          {notice}
        </p>
      )}
      <ErrorText error={error} />
    </form>
  );
}
