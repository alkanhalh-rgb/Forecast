'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Board } from '@/components/Board';
import { PageTitle, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import type { Category } from '@/lib/types';

type Tab = 'week' | 'season' | 'category' | 'friends';

export default function LeaderboardsPage() {
  const { t, pick } = useI18n();
  const { me } = useSession();
  const [tab, setTab] = useState<Tab>('week');
  const { data: cats } = useSWR<Category[]>('/categories', fetcher);
  const [cat, setCat] = useState('spl');
  const path = tab === 'category' ? `/leaderboards/category/${cat}` : `/leaderboards/${tab}`;
  const { data } = useSWR<any>(tab === 'friends' && !me ? null : path, fetcher);
  const tabs: Tab[] = me ? ['week', 'season', 'category', 'friends'] : ['week', 'season', 'category'];
  return (
    <div>
      <PageTitle>{t('leaderboards.title')}</PageTitle>
      <div role="tablist" aria-label={t('leaderboards.title')} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`chip shrink-0 ${tab === x ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>
            {t(`leaderboards.${x}`)}
          </button>
        ))}
      </div>
      {tab === 'category' && (
        <div className="mb-4">
          <label className="label" htmlFor="lbcat">
            {t('admin.category')}
          </label>
          <select id="lbcat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            {cats?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {pick(c, 'name')}
              </option>
            ))}
          </select>
        </div>
      )}
      <div role="tabpanel">{!data ? <Spinner /> : <Board rows={data.rows} mine={data.mine} caption={t(`leaderboards.${tab}`)} />}</div>
    </div>
  );
}
