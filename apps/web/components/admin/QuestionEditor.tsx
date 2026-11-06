'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { fromRiyadhInput, toRiyadhInput } from '@/lib/riyadh-input';
import type { Category } from '@/lib/types';
import { ErrorText } from '../ui';

export interface EditorValue {
  categoryId: string;
  textAr: string;
  textEn: string;
  options: { labelAr: string; labelEn: string }[];
  lockAt: string;
  resolveBy: string;
  sourceName: string;
  sourceUrl: string;
}

export function QuestionEditor({ initial, id, onSaved }: { initial?: Partial<EditorValue>; id?: string; onSaved: (q: any) => void }) {
  const { t, pick } = useI18n();
  const { data: cats } = useSWR<Category[]>('/categories', fetcher);
  const now = Date.now();
  const [v, setV] = useState<EditorValue>({
    categoryId: initial?.categoryId ?? '',
    textAr: initial?.textAr ?? '',
    textEn: initial?.textEn ?? '',
    options: initial?.options ?? [
      { labelAr: 'نعم', labelEn: 'Yes' },
      { labelAr: 'لا', labelEn: 'No' },
    ],
    lockAt: toRiyadhInput(initial?.lockAt ?? new Date(now + 3 * 3600_000)),
    resolveBy: toRiyadhInput(initial?.resolveBy ?? new Date(now + 8 * 3600_000)),
    sourceName: initial?.sourceName ?? '',
    sourceUrl: initial?.sourceUrl ?? '',
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof EditorValue, val: unknown) => setV({ ...v, [k]: val });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...v, lockAt: fromRiyadhInput(v.lockAt), resolveBy: fromRiyadhInput(v.resolveBy) };
      onSaved(await api(id ? `/admin/questions/${id}` : '/admin/questions', { method: id ? 'PUT' : 'POST', body }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3">
      <div>
        <label className="label" htmlFor="cat">
          {t('admin.category')}
        </label>
        <select id="cat" className="input" required value={v.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          <option value="">—</option>
          {cats?.map((c) => (
            <option key={c.id} value={c.id}>
              {pick(c, 'name')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tar">
          {t('admin.textAr')}
        </label>
        <textarea id="tar" dir="rtl" lang="ar" className="input" required value={v.textAr} onChange={(e) => set('textAr', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ten">
          {t('admin.textEn')}
        </label>
        <textarea id="ten" dir="ltr" lang="en" className="input" required value={v.textEn} onChange={(e) => set('textEn', e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">{t('admin.options')}</legend>
        {v.options.map((o, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input aria-label={`${t('admin.optionAr')} ${i + 1}`} dir="rtl" className="input" required value={o.labelAr} onChange={(e) => set('options', v.options.map((x, j) => (j === i ? { ...x, labelAr: e.target.value } : x)))} />
            <input aria-label={`${t('admin.optionEn')} ${i + 1}`} dir="ltr" className="input" required value={o.labelEn} onChange={(e) => set('options', v.options.map((x, j) => (j === i ? { ...x, labelEn: e.target.value } : x)))} />
            <button type="button" className="btn-secondary" aria-label={`${t('admin.removeOption')} ${i + 1}`} disabled={v.options.length <= 2} onClick={() => set('options', v.options.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary" disabled={v.options.length >= 6} onClick={() => set('options', [...v.options, { labelAr: '', labelEn: '' }])}>
          {t('admin.addOption')}
        </button>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lock">
            {t('admin.lockAt')}
          </label>
          <input id="lock" type="datetime-local" className="input num" required value={v.lockAt} onChange={(e) => set('lockAt', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="res">
            {t('admin.resolveBy')}
          </label>
          <input id="res" type="datetime-local" className="input num" required value={v.resolveBy} onChange={(e) => set('resolveBy', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="sn">
          {t('admin.sourceName')}
        </label>
        <input id="sn" className="input" required value={v.sourceName} onChange={(e) => set('sourceName', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="su">
          {t('admin.sourceUrl')}
        </label>
        <input id="su" type="url" dir="ltr" className="input" required value={v.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={busy}>
        {t('admin.saveDraft')}
      </button>
      <ErrorText error={error} />
    </form>
  );
}
