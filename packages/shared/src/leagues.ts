export const DIVISIONS = [1, 2, 3, 4, 5] as const;
export const MIN_DIVISION = 1;
export const MAX_DIVISION = 5;
export const GROUP_SIZE = 30;
export const PROMOTE_COUNT = 5;
export const RELEGATE_COUNT = 5;

export type Movement = 'UP' | 'DOWN' | 'STAY';

export interface GroupMember {
  userId: string;
  weeklyPoints: number;
  joinedAt: Date;
}

export interface RankedMember extends GroupMember {
  finalRank: number;
  movement: Movement;
}

/**
 * Ranks a weekly group (points desc, earlier join wins ties) and assigns movement.
 * Top min(5, n/2) move up, bottom min(5, n/2) move down, bounded by division limits.
 */
export function rankGroup(members: GroupMember[], division: number): RankedMember[] {
  const sorted = [...members].sort((a, b) => b.weeklyPoints - a.weeklyPoints || a.joinedAt.getTime() - b.joinedAt.getTime() || a.userId.localeCompare(b.userId));
  const n = sorted.length;
  const up = Math.min(PROMOTE_COUNT, Math.floor(n / 2));
  const down = Math.min(RELEGATE_COUNT, Math.floor(n / 2));
  return sorted.map((m, i) => {
    let movement: Movement = 'STAY';
    if (i < up && division < MAX_DIVISION) movement = 'UP';
    else if (i >= n - down && division > MIN_DIVISION) movement = 'DOWN';
    return { ...m, finalRank: i + 1, movement };
  });
}

export function nextDivision(division: number, movement: Movement): number {
  const d = movement === 'UP' ? division + 1 : movement === 'DOWN' ? division - 1 : division;
  return Math.min(MAX_DIVISION, Math.max(MIN_DIVISION, d));
}
