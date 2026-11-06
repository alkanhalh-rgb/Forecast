'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Board } from '@/components/Board';
import { PageTitle, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';

export default function FriendLeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { t, n } = useI18n();
  const { data } = useSWR<any>(`/friend-leagues/${id}`, fetcher);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  if (!data) return <Spinner />;
  const link = `${origin}/join/${data.inviteCode}`;
  return (
    <div className="space-y-4">
      <PageTitle>{data.name}</PageTitle>
      <section className="card space-y-2">
        <p className="text-sm text-muted">{t('friends.members', { n: n(data.members) })}</p>
        <label className="label" htmlFor="inv">
          {t('friends.inviteLink')}
        </label>
        <div className="flex gap-2">
          <input id="inv" readOnly dir="ltr" className="input" value={link} />
          <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(link)}>
            {t('common.copy')}
          </button>
        </div>
        <p className="text-sm">
          {t('friends.code')}: <bdi className="num font-bold">{data.inviteCode}</bdi>
        </p>
      </section>
      <h2 className="font-bold">{t('friends.weekRanking')}</h2>
      <Board rows={data.rows} caption={t('friends.weekRanking')} />
    </div>
  );
}
