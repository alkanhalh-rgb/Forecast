'use client';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { riyadhDay, weekStart } from '@app/shared';
import { Icon } from '@/components/Icon';
import { QuestionCard } from '@/components/QuestionCard';
import { Spinner } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useI18n } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import type { Category, QuestionDto } from '@/lib/types';

export default function HomePage() {
  const { t, pick } = useI18n();
  const { me } = useSession();
  const [cat, setCat] = useState('');
  const { data: cats } = useSWR<Category[]>('/categories', fetcher);
  const { data } = useSWR<QuestionDto[]>(`/questions${cat ? `?category=${cat}` : ''}`, fetcher, { refreshInterval: 30000 });
  const chips = [{ slug: '', label: t('feed.all') }, ...(cats ?? []).map((c) => ({ slug: c.slug, label: pick(c, 'name') }))];

  return (
    <div className="flex flex-col gap-5">
      {me?.onboarded ? <Widgets /> : <Welcome />}

      <section aria-labelledby="q-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h1 id="q-h" className="text-xl font-bold">
            {t('feed.title')}
          </h1>
          <span className="text-xs text-muted">{t('common.timesRiyadh')}</span>
        </div>
        <div role="group" aria-label={t('feed.filterLabel')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {chips.map((c) => (
            <button
              key={c.slug || 'all'}
              type="button"
              aria-pressed={cat === c.slug}
              onClick={() => setCat(c.slug)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${cat === c.slug ? 'bg-ink text-white' : 'border border-line bg-surface text-ink'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {!data ? (
          <Spinner />
        ) : data.length === 0 ? (
          <p className="card text-center text-muted">{t('feed.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((q) => (
              <QuestionCard key={q.id} q={q} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Welcome() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-brand-600 p-5 text-white">
      <p className="text-2xl font-bold leading-snug">{t('home.welcomeTitle')}</p>
      <p className="text-brand-100">{t('home.welcomeBody')}</p>
      <Link href="/login" className="btn self-start bg-white text-brand-700 hover:bg-brand-50">
        {t('nav.login')}
      </Link>
    </section>
  );
}

interface Summary {
  stats: { season: { index: number }; seasonPoints: number; weekPoints: number; weekDaily: number[]; scoredForecasts: number; accuracy: number | null };
  streak: { current: number; best: number; shieldAvailable: boolean };
  duelRating: { rating: number };
}

function Widgets() {
  const { t, n, signed } = useI18n();
  const { data: s } = useSWR<Summary>('/me/summary', fetcher);
  const { data: league } = useSWR<any>('/leagues/me', fetcher);
  const { data: duels } = useSWR<any[]>('/duels', fetcher);
  const { data: leagues } = useSWR<any[]>('/friend-leagues', fetcher);
  const firstLeague = leagues?.[0];
  const { data: fl } = useSWR<any>(firstLeague ? `/friend-leagues/${firstLeague.id}` : null, fetcher);
  if (!s) return <Spinner />;

  const daily = s.stats.weekDaily ?? [];
  const maxAbs = Math.max(1, ...daily.map((v) => Math.abs(v)));
  const now = new Date();
  const todayIdx = Math.round((new Date(`${riyadhDay(now)}T00:00:00Z`).getTime() - new Date(`${riyadhDay(weekStart(now))}T00:00:00Z`).getTime()) / 86400000);

  const acc = s.stats.accuracy;
  const ringFill = acc === null ? Math.min(1, s.stats.scoredForecasts / 20) : Math.min(1, Math.max(0.04, (acc + 100) / 200));
  const R = 34;
  const C = 2 * Math.PI * R;

  const myRow = league?.members?.find((m: any) => m.me);
  const zones = { UP: 0, STAY: 0, DOWN: 0 } as Record<string, number>;
  for (const m of league?.members ?? []) zones[m.zone] = (zones[m.zone] ?? 0) + 1;
  const activeDuels = (duels ?? []).filter((d) => d.status === 'ACTIVE' || d.status === 'PENDING').length;

  return (
    <section aria-label={t('home.summary')} className="grid grid-cols-2 gap-3">
      {/* season points + weekly chart */}
      <Link href="/leaderboards" className="col-span-2 flex flex-col gap-3.5 rounded-3xl bg-brand-600 p-[18px] text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[13px] text-brand-100">{t('home.seasonPoints', { n: s.stats.season.index + 1 })}</span>
            <span className="num text-[40px] font-bold leading-tight">{signed(s.stats.seasonPoints)}</span>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-brand-700">{t('home.thisWeek', { n: signed(s.stats.weekPoints) })}</span>
        </div>
        <div aria-hidden className="flex h-14 items-end gap-2">
          {Array.from({ length: 7 }, (_, i) => {
            const v = daily[i] ?? 0;
            const h = v === 0 ? 8 : Math.max(12, (Math.abs(v) / maxAbs) * 100);
            const bg = i === todayIdx ? 'bg-amber' : i > todayIdx ? 'bg-white/15' : v < 0 ? 'bg-[#f3c9bd]' : 'bg-[#3f8f74]';
            return <div key={i} className={`flex-1 rounded-md ${bg}`} style={{ height: `${h}%` }} />;
          })}
        </div>
        <div className="flex justify-between text-xs text-brand-100">
          <span>{t('home.sunday')}</span>
          <span>{t('home.today')}</span>
        </div>
      </Link>

      {/* streak */}
      <Link href="/me" className="widget min-h-[150px]">
        <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-[#b26b00]">
          <Icon name="flame" size={22} />
        </span>
        <span className="text-[13px] text-muted">{t('home.streak')}</span>
        <span className="text-[28px] font-bold leading-tight">{t('home.streakDays', { n: n(s.streak.current) })}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Icon name="shield" size={14} />
          {s.streak.shieldAvailable ? t('home.shieldAvailable') : t('home.shieldUsed')}
        </span>
      </Link>

      {/* accuracy ring */}
      <Link href="/me" className="widget min-h-[150px] items-center justify-center">
        <span className="relative size-[84px]">
          <svg role="img" aria-label={`${t('home.accuracy')}: ${acc === null ? '—' : acc}`} width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--color-track)" strokeWidth="10" />
            <circle cx="42" cy="42" r={R} fill="none" stroke={acc === null ? 'var(--color-amber)' : 'var(--color-brand-600)'} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * ringFill} ${C}`} transform="rotate(-90 42 42)" />
          </svg>
          <span className="num absolute inset-0 flex items-center justify-center text-xl font-bold">{acc === null ? `${n(s.stats.scoredForecasts)}/20` : signed(acc)}</span>
        </span>
        <span className="text-center text-[13px] text-muted">{acc === null ? t('home.accuracyLocked', { n: n(s.stats.scoredForecasts) }) : t('home.accuracy')}</span>
      </Link>

      {/* weekly league */}
      <Link href="/league" className="widget col-span-2 gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name="trophy" size={22} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">{t('home.league', { n: n(league?.division ?? 1) })}</span>
              <span className="text-xs text-muted">{t('home.leagueEnds')}</span>
            </span>
          </div>
          {myRow && <span className="num text-[26px] font-bold">#{n(myRow.rank)}</span>}
        </div>
        {myRow ? (
          <>
            <div aria-hidden className="flex h-2.5 gap-[3px]">
              {zones.UP > 0 && <div className="rounded-md bg-brand-600" style={{ flexGrow: zones.UP }} />}
              {zones.STAY > 0 && <div className="rounded-md bg-track" style={{ flexGrow: zones.STAY }} />}
              {zones.DOWN > 0 && <div className="rounded-md bg-[#f3c9bd]" style={{ flexGrow: zones.DOWN }} />}
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>{t(myRow.zone === 'UP' ? 'home.zoneUp' : myRow.zone === 'DOWN' ? 'home.zoneDown' : 'home.zoneStay')}</span>
              <span>{t('home.ofN', { n: n(league.members.length) })}</span>
            </div>
          </>
        ) : (
          <span className="text-xs text-muted">{t('home.leagueJoin')}</span>
        )}
      </Link>

      {/* challenge rating */}
      <Link href="/duels" className="widget">
        <span className="text-[13px] text-muted">{t('home.duelRating')}</span>
        <span className="num text-[26px] font-bold">{n(s.duelRating.rating)}</span>
        <span className="pill self-start bg-blue-50 text-blue">{activeDuels > 0 ? t('home.duelWaiting', { n: n(activeDuels) }) : t('home.duelStart')}</span>
      </Link>

      {/* friend league */}
      <Link href={firstLeague ? `/friends/${firstLeague.id}` : '/friends'} className="widget">
        <span className="truncate text-[13px] text-muted">{firstLeague?.name ?? t('home.friends')}</span>
        {fl?.mine ? (
          <>
            <span className="num text-[26px] font-bold">#{n(fl.mine.rank)}</span>
            <span className="text-xs text-muted">{t('home.friendsOf', { n: n(fl.members) })}</span>
          </>
        ) : (
          <span className="text-sm font-semibold text-brand-600">{t('home.friendsCreate')}</span>
        )}
      </Link>
    </section>
  );
}
