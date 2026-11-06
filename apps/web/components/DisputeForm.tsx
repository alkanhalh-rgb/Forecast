'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { ErrorText } from './ui';

export function DisputeForm({ questionId, until, onSent }: { questionId: string; until: string; onSent: () => void }) {
  const { t, dt } = useI18n();
  const [open, setOpen] = useState(false);
  const [evidenceUrl, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<unknown>(null);
  if (!open)
    return (
      <div>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          {t('question.report')}
        </button>
        <p className="mt-1 text-xs text-muted">{t('question.reportUntil', { time: dt(until) })}</p>
      </div>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/questions/${questionId}/disputes`, { body: { evidenceUrl, message } });
          onSent();
        } catch (err) {
          setError(err);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="ev">
          {t('question.evidenceUrl')}
        </label>
        <input id="ev" className="input" dir="ltr" type="url" required value={evidenceUrl} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="msg">
          {t('question.reportMessage')}
        </label>
        <textarea id="msg" className="input" required minLength={5} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button className="btn-primary">{t('common.submit')}</button>
      <ErrorText error={error} />
    </form>
  );
}
