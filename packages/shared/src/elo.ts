/** Duel rating (Elo). Completely separate from season points and leaderboards. */
export const ELO_START = 1200;
export const ELO_K = 32;

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/** resultA: 1 = A won, 0.5 = tie, 0 = A lost. Returns new ratings and integer deltas. */
export function eloUpdate(ra: number, rb: number, resultA: 0 | 0.5 | 1, k = ELO_K) {
  const ea = expectedScore(ra, rb);
  const deltaA = Math.round(k * (resultA - ea));
  const deltaB = Math.round(k * (1 - resultA - (1 - ea)));
  return { a: ra + deltaA, b: rb + deltaB, deltaA, deltaB };
}
