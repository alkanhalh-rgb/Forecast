/** Confidence levels a user may choose (percent). */
export const CONFIDENCE_LEVELS = [60, 75, 90] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export function isConfidence(n: unknown): n is Confidence {
  return typeof n === 'number' && (CONFIDENCE_LEVELS as readonly number[]).includes(n);
}

/**
 * Logarithmic accuracy score relative to a uniform baseline.
 *   score = round(100 * log2(p / baseline)), baseline = 1/k
 *   p = confidence if the pick was right, else (1 - confidence) / (k - 1)
 * Points are a score, never a balance: nothing is spent or transferred.
 */
export function forecastScore(confidencePct: Confidence | number, correct: boolean, optionCount: number): number {
  if (optionCount < 2) throw new Error('optionCount must be >= 2');
  if (!isConfidence(confidencePct)) throw new Error(`invalid confidence ${confidencePct}`);
  const c = confidencePct / 100;
  const k = optionCount;
  const p = correct ? c : (1 - c) / (k - 1);
  const raw = 100 * Math.log2(p * k);
  const r = Math.round(raw);
  return r === 0 ? 0 : r; // normalise -0
}

/** Season points are the plain sum of scores within the season window. */
export function sumPoints(scores: { points: number }[]): number {
  return scores.reduce((a, s) => a + s.points, 0);
}

export const ACCURACY_MIN_FORECASTS = 20;
export const ACCURACY_WINDOW_DAYS = 30;

/**
 * Accuracy rating = average score over the last 30 days, only shown once the user
 * has at least 20 scored forecasts (DECISIONS.md #7).
 */
export function accuracyRating(totalScoredForecasts: number, windowPoints: number[]): number | null {
  if (totalScoredForecasts < ACCURACY_MIN_FORECASTS) return null;
  if (windowPoints.length === 0) return null;
  return Math.round(windowPoints.reduce((a, b) => a + b, 0) / windowPoints.length);
}

// ----- Lock enforcement -----
export type QuestionStatus = 'DRAFT' | 'REVIEW' | 'LIVE' | 'LOCKED' | 'RESOLVED' | 'FINAL' | 'VOID';

/** Server-side rule: a forecast is accepted only while LIVE and strictly before lockAt. */
export function canForecast(q: { status: QuestionStatus; lockAt: Date }, at: Date): { ok: true } | { ok: false; reason: 'NOT_LIVE' | 'LOCKED' } {
  if (q.status !== 'LIVE') return { ok: false, reason: q.status === 'LOCKED' ? 'LOCKED' : 'NOT_LIVE' };
  if (at.getTime() >= q.lockAt.getTime()) return { ok: false, reason: 'LOCKED' };
  return { ok: true };
}

/** Crowd share per option from raw counters. */
export function crowdShares(counts: Record<string, number>, optionIds: string[]): { total: number; shares: Record<string, number> } {
  const total = optionIds.reduce((a, id) => a + Math.max(0, counts[id] ?? 0), 0);
  const shares: Record<string, number> = {};
  for (const id of optionIds) shares[id] = total === 0 ? 0 : Math.max(0, counts[id] ?? 0) / total;
  return { total, shares };
}
