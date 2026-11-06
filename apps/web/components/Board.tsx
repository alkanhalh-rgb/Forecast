'use client';
import { useI18n } from '@/lib/i18n-client';

export interface BoardRow {
  rank: number;
  nickname: string | null;
  points: number;
  me: boolean;
  zone?: 'UP' | 'DOWN' | 'STAY';
}

/** Ranking table: nicknames only, never phone numbers or real names. */
export function Board({ rows, mine, caption }: { rows: BoardRow[]; mine?: BoardRow | null; caption: string }) {
  const { t, n, signed } = useI18n();
  if (rows.length === 0) return <p className="card text-center text-muted">{t('leaderboards.empty')}</p>;
  const zoneClass = (z?: string) => (z === 'UP' ? 'border-s-4 border-s-good' : z === 'DOWN' ? 'border-s-4 border-s-bad' : 'border-s-4 border-s-transparent');
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-start">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-gray-100 text-sm">
          <tr>
            <th scope="col" className="px-3 py-2 text-start">
              {t('leaderboards.rank')}
            </th>
            <th scope="col" className="px-3 py-2 text-start">
              {t('leaderboards.player')}
            </th>
            <th scope="col" className="px-3 py-2 text-end">
              {t('leaderboards.points')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.rank}-${r.nickname}`} className={`border-t border-line ${r.me ? 'bg-brand-50 font-bold' : ''} ${zoneClass(r.zone)}`} aria-current={r.me ? 'true' : undefined}>
              <td className="num px-3 py-2">{n(r.rank)}</td>
              <td className="px-3 py-2">
                <bdi>{r.nickname}</bdi> {r.me && <span className="text-sm font-normal text-muted">({t('common.you')})</span>}
              </td>
              <td className="num px-3 py-2 text-end">{signed(r.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mine && !rows.some((r) => r.me) && <p className="border-t border-line bg-brand-50 px-3 py-2 font-bold">{t('leaderboards.yourRank', { rank: n(mine.rank) })}</p>}
    </div>
  );
}
