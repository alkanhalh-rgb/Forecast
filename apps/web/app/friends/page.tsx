'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { ErrorText, PageTitle, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';

export default function FriendsPage() {
  const { t, n } = useI18n();
  const router = useRouter();
  const { data } = useSWR<any[]>('/friend-leagues', fetcher);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="space-y-4">
      <PageTitle>{t('friends.title')}</PageTitle>
      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="card text-muted">{t('friends.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((l) => (
            <li key={l.id}>
              <Link href={`/friends/${l.id}`} className="card block hover:border-brand-600">
                <p className="font-bold">{l.name}</p>
                <p className="text-sm text-muted">{t('friends.members', { n: n(l.members) })}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form
        className="card space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const l = await api('/friend-leagues', { body: { name } });
            router.push(`/friends/${l.id}`);
          } catch (err) {
            setError(err);
          }
        }}
      >
        <label className="label" htmlFor="fl-name">
          {t('friends.name')}
        </label>
        <input id="fl-name" className="input" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary w-full">{t('friends.create')}</button>
      </form>
      <form
        className="card space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const l = await api('/friend-leagues/join', { body: { code } });
            router.push(`/friends/${l.id}`);
          } catch (err) {
            setError(err);
          }
        }}
      >
        <label className="label" htmlFor="fl-code">
          {t('friends.joinWithCode')}
        </label>
        <input id="fl-code" className="input num uppercase" dir="ltr" required value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn-secondary w-full">{t('friends.join')}</button>
      </form>
      <ErrorText error={error} />
    </div>
  );
}
