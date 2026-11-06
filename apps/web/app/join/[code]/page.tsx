'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { ErrorText, PageTitle, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const { t, n } = useI18n();
  const { me } = useSession();
  const router = useRouter();
  const { data, error: loadError } = useSWR<any>(`/friend-leagues/code/${code}`, fetcher);
  const [error, setError] = useState<unknown>(null);
  if (loadError) return <ErrorText error={loadError} />;
  if (!data) return <Spinner />;
  return (
    <div className="card space-y-3">
      <PageTitle>{t('friends.joinedTitle')}</PageTitle>
      <p>{t('friends.joinPrompt', { name: data.name })}</p>
      <p className="text-sm text-muted">{t('friends.members', { n: n(data.members) })}</p>
      {data.full ? (
        <p className="text-bad">{t('friends.full')}</p>
      ) : me ? (
        <button
          className="btn-primary w-full"
          onClick={async () => {
            try {
              const l = await api('/friend-leagues/join', { body: { code } });
              router.push(`/friends/${l.id}`);
            } catch (e) {
              setError(e);
            }
          }}
        >
          {t('friends.join')}
        </button>
      ) : (
        <Link className="btn-primary w-full" href={`/login?next=/join/${code}`}>
          {t('nav.login')}
        </Link>
      )}
      <ErrorText error={error} />
    </div>
  );
}
