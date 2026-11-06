'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { QuestionEditor } from '@/components/admin/QuestionEditor';
import { ErrorText } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { fromRiyadhInput } from '@/lib/riyadh-input';

interface Template {
  key: string;
  nameAr: string;
  nameEn: string;
  params: { name: string; type: string; labelAr: string; labelEn: string }[];
}

export default function NewQuestion() {
  const { t, pick } = useI18n();
  const router = useRouter();
  const { data: templates } = useSWR<Template[]>('/admin/templates', fetcher);
  const [key, setKey] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const tpl = templates?.find((x) => x.key === key);

  return (
    <div className="space-y-6">
      <section className="card space-y-3" aria-labelledby="tpl-h">
        <h2 id="tpl-h" className="font-bold">
          {t('admin.templates')}
        </h2>
        <select aria-label={t('admin.templates')} className="input" value={key} onChange={(e) => { setKey(e.target.value); setParams({}); }}>
          <option value="">—</option>
          {templates?.map((x) => (
            <option key={x.key} value={x.key}>
              {pick(x, 'name')}
            </option>
          ))}
        </select>
        {tpl && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                const p = Object.fromEntries(tpl.params.map((x) => [x.name, x.type === 'datetime' ? fromRiyadhInput(params[x.name] ?? '') : (params[x.name] ?? '')]));
                const q = await api(`/admin/templates/${tpl.key}`, { body: { params: p } });
                router.push(`/admin/q/${q.id}`);
              } catch (err) {
                setError(err);
              }
            }}
          >
            {tpl.params.map((x) => (
              <div key={x.name}>
                <label className="label" htmlFor={`p-${x.name}`}>
                  {pick(x, 'label')}
                </label>
                <input
                  id={`p-${x.name}`}
                  className="input num"
                  required
                  type={x.type === 'day' ? 'date' : x.type === 'datetime' ? 'datetime-local' : x.type === 'number' ? 'number' : 'text'}
                  value={params[x.name] ?? ''}
                  onChange={(e) => setParams({ ...params, [x.name]: e.target.value })}
                />
              </div>
            ))}
            <button className="btn-primary w-full">{t('admin.generate')}</button>
            <ErrorText error={error} />
          </form>
        )}
      </section>
      <section aria-labelledby="new-h">
        <h2 id="new-h" className="mb-2 font-bold">
          {t('admin.new')}
        </h2>
        <QuestionEditor onSaved={(q) => router.push(`/admin/q/${q.id}`)} />
      </section>
    </div>
  );
}
