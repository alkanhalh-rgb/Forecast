'use client';
import useSWR from 'swr';
import { Board } from '@/components/Board';
import { PageTitle, Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';

export default function LeaguePage() {
  const { t, n, dt } = useI18n();
  const { data } = useSWR<any>('/leagues/me', fetcher);
  if (!data) return <Spinner />;
  return (
    <div className="space-y-4">
      <PageTitle>{t('league.title')}</PageTitle>
      <section className="card space-y-1">
        <p className="text-xl font-bold">{t('league.division', { n: n(data.division) })}</p>
        <p className="text-sm text-muted">{t('league.intro')}</p>
        <p className="num text-sm">{t('league.endsAt', { time: dt(data.endsAt) })}</p>
        {data.lastWeek && <p className="text-sm font-medium">{t('league.lastWeek', { rank: n(data.lastWeek.rank), movement: t(`movement.${data.lastWeek.movement}`) })}</p>}
      </section>
      {data.joined ? (
        <>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span aria-hidden className="inline-block size-3 rounded-sm bg-good" /> {t('league.promotion')}
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="inline-block size-3 rounded-sm bg-bad" /> {t('league.relegation')}
            </span>
          </div>
          <Board rows={data.members} caption={t('league.title')} />
        </>
      ) : (
        <p className="card text-muted">{t('league.notJoined')}</p>
      )}
    </div>
  );
}
