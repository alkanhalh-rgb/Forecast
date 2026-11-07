'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { PageTitle, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { duelResultKey, type DuelDto } from '@/lib/duel-types';
import { useI18n } from '@/lib/i18n-client';

export default function DuelsPage() {
  const { t, n, pick } = useI18n();
  const { data } = useSWR<DuelDto[]>('/duels', fetcher);
  const { data: rating } = useSWR<{ rating: number; duelsPlayed: number; wins: number }>('/duels/rating/me', fetcher);
  return (
    <div className="space-y-4">
      <PageTitle>{t('duels.title')}</PageTitle>
      <p className="text-muted">{t('duels.intro')}</p>
      {rating && (
        <section className="card">
          <p className="text-lg font-bold">{t('duels.rating', { n: n(rating.rating) })}</p>
          <p className="text-sm text-muted">{t('duels.ratingNote')}</p>
        </section>
      )}
      <Link href="/duels/new" className="btn-primary w-full">
        {t('duels.new')}
      </Link>
      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="card text-center text-muted">{t('duels.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => {
            const rk = duelResultKey(d);
            return (
              <li key={d.id}>
                <Link href={`/duels/${d.id}`} className="card block hover:border-brand-600">
                  <div className="mb-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-track px-2 py-0.5 font-medium">{t(`duelStatus.${d.status}`)}</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">{t(`duels.${d.format}`)}</span>
                  </div>
                  <p className="font-medium">{t('duels.vs', { a: d.challenger.nickname, b: d.opponent?.nickname ?? '…' })}</p>
                  <p className="text-sm text-muted">{pick(d.questions[0]!.question, 'text')}</p>
                  {rk && <p className="mt-1 font-bold">{t(rk)}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
