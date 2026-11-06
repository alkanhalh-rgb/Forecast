import { addDays, dayDiff, weekKey, riyadhDayStart } from './time';

export const SHIELDS_PER_WEEK = 1;

export interface StreakState {
  current: number;
  best: number;
  lastActiveDay: string | null; // YYYY-MM-DD Riyadh
  shieldsUsedThisWeek: number;
  shieldWeek: string | null; // week key the shield counter refers to
}

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, lastActiveDay: null, shieldsUsedThisWeek: 0, shieldWeek: null };

/**
 * Apply a forecast made on Riyadh day `day`. A streak day = a calendar day with >= 1 forecast.
 * One free shield per week covers exactly one missed day, applied automatically.
 */
export function applyStreakDay(s: StreakState, day: string): StreakState & { shieldUsed: boolean } {
  if (s.lastActiveDay === day) return { ...s, shieldUsed: false };
  if (s.lastActiveDay && dayDiff(s.lastActiveDay, day) < 0) return { ...s, shieldUsed: false }; // out of order: ignore

  let { current, shieldsUsedThisWeek, shieldWeek } = s;
  let shieldUsed = false;
  const gap = s.lastActiveDay ? dayDiff(s.lastActiveDay, day) : Infinity;

  if (gap === 1) current += 1;
  else if (gap === 2) {
    const missed = addDays(s.lastActiveDay!, 1);
    const missedWeek = weekKey(riyadhDayStart(missed));
    const used = shieldWeek === missedWeek ? shieldsUsedThisWeek : 0;
    if (used < SHIELDS_PER_WEEK) {
      shieldUsed = true;
      shieldWeek = missedWeek;
      shieldsUsedThisWeek = used + 1;
      current += 1;
    } else current = 1;
  } else current = 1;

  return { current, best: Math.max(s.best, current), lastActiveDay: day, shieldsUsedThisWeek, shieldWeek, shieldUsed };
}

/** Streak as displayed today: a streak survives today until the day ends, and one missed day if a shield is available. */
export function displayedStreak(s: StreakState, today: string): number {
  if (!s.lastActiveDay) return 0;
  const gap = dayDiff(s.lastActiveDay, today);
  if (gap <= 1) return s.current;
  if (gap === 2) {
    const missedWeek = weekKey(riyadhDayStart(addDays(s.lastActiveDay, 1)));
    const used = s.shieldWeek === missedWeek ? s.shieldsUsedThisWeek : 0;
    return used < SHIELDS_PER_WEEK ? s.current : 0;
  }
  return 0;
}
