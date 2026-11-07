'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n-client';
import type { QuestionDto } from '@/lib/types';
import { Icon } from './Icon';

/** One colour per option, in order; adjacent colours differ in lightness, not only hue. */
export const OPTION_COLORS = ['#0b6b4f', '#f2b544', '#6e8a80', '#1e46b4', '#9c2b10', '#4a5a55'];

const CATEGORY_PILL: Record<string, string> = {
  spl: 'bg-brand-50 text-brand-700',
  tadawul: 'bg-blue-50 text-blue',
  oil: 'bg-[#efe7dc] text-[#5c3d12]',
  weather: 'bg-amber-50 text-[#7a4a00]',
  events: 'bg-[#f3e8f4] text-[#6b2c74]',
  tech: 'bg-[#e6eef3] text-[#1f4a63]',
};

export function categoryPill(slug: string) {
  return CATEGORY_PILL[slug] ?? 'bg-brand-50 text-brand-700';
}

export function useRelative() {
  const { t, n } = useI18n();
  return (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return null;
    const m = Math.round(ms / 60000);
    if (m < 60) return t('time.minutes', { n: n(m) });
    const h = Math.floor(m / 60);
    return t('time.hours', { n: n(h), m: n(m % 60) });
  };
}

/** Horizontal crowd split: one segment per option. */
export function CrowdBar({ q }: { q: QuestionDto }) {
  const { pick, n } = useI18n();
  if (!q.crowd) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] font-semibold">
        {q.options.map((o, i) => (
          <span key={o.id} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
            {pick(o, 'label')} <bdi className="num">{n(Math.round((q.crowd!.shares[o.id] ?? 0) * 100))}%</bdi>
          </span>
        ))}
      </div>
      <div aria-hidden className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-track">
        {q.options.map((o, i) => {
          const share = q.crowd!.shares[o.id] ?? 0;
          return share > 0 ? <div key={o.id} style={{ flexGrow: share, background: OPTION_COLORS[i % OPTION_COLORS.length] }} /> : null;
        })}
      </div>
    </div>
  );
}

export function QuestionCard({ q }: { q: QuestionDto }) {
  const { t, pick, time, n } = useI18n();
  const rel = useRelative()(q.lockAt);
  const mine = q.myForecast;
  const opt = (id: string) => q.options.find((o) => o.id === id);
  return (
    <li>
      <article className={`card flex flex-col gap-3.5 ${mine ? 'outline-2 outline-brand-600' : ''}`} aria-labelledby={`qc-${q.id}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`pill ${categoryPill(q.category.slug)}`}>{pick(q.category, 'name')}</span>
          {mine ? (
            <span className="pill bg-brand-50 text-brand-700">
              <Icon name="check" size={14} strokeWidth={2.6} />
              {t('feed.answered')}
            </span>
          ) : (
            <span className="pill bg-amber-50 text-amber-700">
              <Icon name="clock" size={14} strokeWidth={2.4} />
              {rel ? t('home.locksIn', { time: rel }) : t('feed.locksAt', { time: time(q.lockAt) })}
            </span>
          )}
        </div>
        <h3 id={`qc-${q.id}`} className="text-lg font-bold leading-relaxed">
          <Link href={`/q/${q.id}`} className="hover:underline">
            {pick(q, 'text')}
          </Link>
        </h3>
        {mine ? (
          <>
            <CrowdBar q={q} />
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-soft px-3 py-2.5 text-[13px]">
              <span>{t('home.yourPick', { option: pick(opt(mine.optionId) ?? {}, 'label'), n: `${mine.confidence}%` })}</span>
              <Link href={`/q/${q.id}`} className="font-semibold text-brand-600 underline-offset-2 hover:underline">
                {t('home.edit')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(q.options.length, 3)}, minmax(0, 1fr))` }}>
              {q.options.map((o) => (
                <Link key={o.id} href={`/q/${q.id}?pick=${o.id}`} className="flex min-h-13 items-center justify-center rounded-2xl border border-line bg-soft px-2 text-center text-sm font-semibold hover:border-brand-600 hover:bg-brand-50">
                  {pick(o, 'label')}
                </Link>
              ))}
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted">
              <span>{t('home.crowdAfter')}</span>
              <span>{t('home.forecasters', { n: n(q.forecasters ?? 0) })}</span>
            </div>
          </>
        )}
      </article>
    </li>
  );
}
