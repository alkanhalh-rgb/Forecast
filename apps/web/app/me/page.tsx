'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ErrorText, PageTitle, Spinner } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { enablePush, pushSupported } from '@/lib/push';
import { useSession } from '@/lib/session';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="num text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function MePage() {
  const { t, n, signed, dt, locale } = useI18n();
  const { me, refresh } = useSession();
  const router = useRouter();
  const { data } = useSWR<any>('/me/summary', fetcher);
  const { data: inbox } = useSWR<any[]>('/notifications', fetcher);
  const [push, setPush] = useState<'idle' | 'on' | 'unsupported'>('idle');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!pushSupported()) setPush('unsupported');
    else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') setPush('on');
  }, []);
  if (!data || !me) return <Spinner />;
  const s = data.stats;
  return (
    <div className="space-y-4">
      <PageTitle>
        {t('me.title')} · <bdi>{data.nickname}</bdi>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('me.seasonPoints')} value={signed(s.seasonPoints)} />
        <Stat label={t('me.weekPoints')} value={signed(s.weekPoints)} />
        <Stat label={t('me.accuracy')} value={s.accuracy === null ? '—' : signed(s.accuracy)} hint={s.accuracy === null ? t('me.accuracyHidden', { n: n(s.scoredForecasts) }) : t('me.forecasts', { n: n(s.scoredForecasts) })} />
        <Stat
          label={t('me.streak')}
          value={t('me.streakDays', { n: n(data.streak.current) })}
          hint={`${t('me.bestStreak', { n: n(data.streak.best) })} · ${t('me.shield', { state: data.streak.shieldAvailable ? t('me.shieldAvailable') : t('me.shieldUsed') })}`}
        />
        <Stat label={t('me.duelRating')} value={n(data.duelRating.rating)} hint={t('duels.ratingNote')} />
      </div>

      <section className="card" aria-labelledby="badges-h">
        <h2 id="badges-h" className="mb-2 font-bold">
          {t('me.badges')}
        </h2>
        {data.badges.length === 0 ? (
          <p className="text-muted">{t('me.noBadges')}</p>
        ) : (
          <ul className="space-y-2">
            {data.badges.map((b: any) => (
              <li key={b.id} className="flex items-start gap-2">
                <span aria-hidden>🏅</span>
                <span>
                  <span className="font-medium">{t(`badges.${b.badge}.name`)}</span>
                  <span className="block text-sm text-muted">{t(`badges.${b.badge}.desc`)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.shareCards.length > 0 && (
        <section className="card space-y-2" aria-labelledby="cards-h">
          <h2 id="cards-h" className="font-bold">
            {t('me.shareCards')}
          </h2>
          {data.shareCards.map((c: any) => (
            <a key={c.id} href={`/api/share/${c.id}.png`} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/share/${c.id}.png`} alt={c.kind === 'DUEL_WIN' ? t('duels.won') : t('badges.BEAT_THE_CROWD.name')} className="w-full rounded-xl border border-line" loading="lazy" />
            </a>
          ))}
        </section>
      )}

      <section className="card space-y-2" aria-labelledby="notif-h">
        <h2 id="notif-h" className="font-bold">
          {t('me.notifications')}
        </h2>
        <p className="text-sm text-muted">{t('me.quietHours')}</p>
        {push === 'unsupported' ? (
          <p className="text-sm">{t('me.pushUnsupported')}</p>
        ) : push === 'on' ? (
          <p className="text-sm text-good">{t('me.pushEnabled')}</p>
        ) : (
          <button className="btn-secondary" onClick={async () => setPush((await enablePush().catch(() => false)) ? 'on' : 'idle')}>
            {t('me.enablePush')}
          </button>
        )}
        <h3 className="pt-2 font-medium">{t('me.inbox')}</h3>
        {!inbox?.length ? (
          <p className="text-sm text-muted">{t('me.inboxEmpty')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {inbox.map((x) => (
              <li key={x.id}>
                <a href={x.url ?? '#'} className="block rounded-lg border border-line p-2 hover:border-brand-600">
                  <span className="font-medium">{t(x.titleKey)}</span>
                  <span className="block text-muted">
                    {x.params?.[locale === 'ar' ? 'questionAr' : 'questionEn'] ?? ''}
                    {typeof x.params?.points === 'number' && <> · {signed(x.params.points)}</>}
                    {x.params?.result && <> · {t(`notifications.duel${x.params.result === 'WON' ? 'Won' : x.params.result === 'LOST' ? 'Lost' : x.params.result === 'TIE' ? 'Tie' : 'Void'}`)}</>}
                    {x.params?.decision && <> · {t(`notifications.${x.params.decision}`)}</>}
                  </span>
                  <span className="num block text-xs text-muted">{dt(x.sentAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="priv-h">
        <h2 id="priv-h" className="font-bold">
          {t('me.privacy')}
        </h2>
        <a className="btn-secondary w-full" href="/api/me/export" download>
          {t('me.export')}
        </a>
        <label className="label" htmlFor="del">
          {t('me.deleteConfirm')}
        </label>
        <input id="del" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button
          className="btn-danger w-full"
          disabled={confirm !== data.nickname}
          onClick={async () => {
            try {
              await api('/me', { method: 'DELETE', body: { confirmNickname: confirm } });
              await refresh(null, { revalidate: false });
              router.replace('/');
            } catch (e) {
              setError(e);
            }
          }}
        >
          {t('me.delete')}
        </button>
        <button
          className="btn-secondary w-full"
          onClick={async () => {
            await api('/auth/logout', { method: 'POST' });
            await refresh(null, { revalidate: false });
            router.replace('/');
          }}
        >
          {t('auth.logout')}
        </button>
        <ErrorText error={error} />
      </section>
    </div>
  );
}
