export const BADGES = ['CALIBRATED', 'BEAT_THE_CROWD', 'DUEL_WIN_1', 'DUEL_WIN_10', 'DUEL_WIN_50', 'SEASON_CATEGORY_TITLE'] as const;
export type Badge = (typeof BADGES)[number];

export const CALIBRATED_MIN = 30;
export const CALIBRATED_LOW = 0.65;
export const CALIBRATED_HIGH = 0.85;

/** Calibrated: 30+ scored forecasts at 75% confidence with a hit rate within [65%, 85%]. */
export function isCalibrated(forecastsAt75: { correct: boolean }[]): boolean {
  if (forecastsAt75.length < CALIBRATED_MIN) return false;
  const rate = forecastsAt75.filter((f) => f.correct).length / forecastsAt75.length;
  return rate >= CALIBRATED_LOW && rate <= CALIBRATED_HIGH;
}

export const BEAT_CROWD_MIN_FORECASTERS = 20;
export const BEAT_CROWD_MAX_SHARE = 0.3;

/** Beat the Crowd: correct on an option chosen by under 30% of at least 20 forecasters (snapshot at lock). */
export function beatsTheCrowd(correct: boolean, optionCount: number, totalForecasters: number): boolean {
  if (!correct) return false;
  if (totalForecasters < BEAT_CROWD_MIN_FORECASTERS) return false;
  return optionCount / totalForecasters < BEAT_CROWD_MAX_SHARE;
}

export const DUEL_MILESTONES: { wins: number; badge: Badge }[] = [
  { wins: 1, badge: 'DUEL_WIN_1' },
  { wins: 10, badge: 'DUEL_WIN_10' },
  { wins: 50, badge: 'DUEL_WIN_50' },
];

export function duelMilestoneBadges(totalWins: number): Badge[] {
  return DUEL_MILESTONES.filter((m) => totalWins >= m.wins).map((m) => m.badge);
}

/** Top 1% (at least one) of users with positive category points in a season. */
export function categoryTitleHolders(ranking: { userId: string; points: number }[]): string[] {
  const positive = [...ranking].filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
  if (positive.length === 0) return [];
  const n = Math.max(1, Math.ceil(positive.length * 0.01));
  const cutoff = positive[n - 1]!.points;
  return positive.filter((r) => r.points >= cutoff).map((r) => r.userId);
}
