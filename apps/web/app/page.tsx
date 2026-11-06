'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { QuestionCard } from '@/components/QuestionCard';
import { PageTitle, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import type { Category, QuestionDto } from '@/lib/types';

export default function FeedPage() {
  const { t, pick } = useI18n();
  const [cat, setCat] = useState('');
  const { data: cats } = useSWR<Category[]>('/categories', fetcher);
  const { data } = useSWR<QuestionDto[]>(`/questions${cat ? `?category=${cat}` : ''}`, fetcher, { refreshInterval: 30000 });
  const chips = [{ slug: '', label: t('feed.all') }, ...(cats ?? []).map((c) => ({ slug: c.slug, label: pick(c, 'name') }))];
  return (
    <div>
      <PageTitle>{t('feed.title')}</PageTitle>
      <div role="group" aria-label={t('feed.filterLabel')} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chips.map((c) => (
          <button
            key={c.slug || 'all'}
            type="button"
            aria-pressed={cat === c.slug}
            onClick={() => setCat(c.slug)}
            className={`chip shrink-0 ${cat === c.slug ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted">{t('common.timesRiyadh')}</p>
      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="card text-center text-muted">{t('feed.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {data.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </ul>
      )}
    </div>
  );
}
