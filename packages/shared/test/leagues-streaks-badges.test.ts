import { describe, expect, it } from 'vitest';
import {
  applyStreakDay,
  beatsTheCrowd,
  categoryTitleHolders,
  displayedStreak,
  duelMilestoneBadges,
  EMPTY_STREAK,
  isCalibrated,
  nextDivision,
  rankGroup,
} from '../src';

const members = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(2, '0')}`, weeklyPoints: 1000 - i * 10, joinedAt: new Date(2026, 0, 1, 0, i) }));

describe('league promotion and relegation', () => {
  it('top 5 up, bottom 5 down in a full group of 30', () => {
    const r = rankGroup(members(30), 3);
    expect(r.filter((m) => m.movement === 'UP').map((m) => m.finalRank)).toEqual([1, 2, 3, 4, 5]);
    expect(r.filter((m) => m.movement === 'DOWN').map((m) => m.finalRank)).toEqual([26, 27, 28, 29, 30]);
    expect(r.filter((m) => m.movement === 'STAY')).toHaveLength(20);
  });
  it('division 5 cannot move up, division 1 cannot move down', () => {
    expect(rankGroup(members(30), 5).some((m) => m.movement === 'UP')).toBe(false);
    expect(rankGroup(members(30), 1).some((m) => m.movement === 'DOWN')).toBe(false);
  });
  it('small groups move min(5, n/2) each way and never overlap', () => {
    const r = rankGroup(members(7), 3);
    expect(r.filter((m) => m.movement === 'UP')).toHaveLength(3);
    expect(r.filter((m) => m.movement === 'DOWN')).toHaveLength(3);
    expect(rankGroup(members(1), 3)[0]!.movement).toBe('STAY');
  });
  it('ranks by points then earlier join', () => {
    const r = rankGroup(
      [
        { userId: 'late', weeklyPoints: 50, joinedAt: new Date(2026, 0, 2) },
        { userId: 'early', weeklyPoints: 50, joinedAt: new Date(2026, 0, 1) },
        { userId: 'top', weeklyPoints: 90, joinedAt: new Date(2026, 0, 3) },
      ],
      2,
    );
    expect(r.map((m) => m.userId)).toEqual(['top', 'early', 'late']);
  });
  it('nextDivision is bounded', () => {
    expect(nextDivision(5, 'UP')).toBe(5);
    expect(nextDivision(1, 'DOWN')).toBe(1);
    expect(nextDivision(2, 'UP')).toBe(3);
  });
});

describe('streaks and shields', () => {
  it('consecutive days increase the streak; same day is idempotent', () => {
    let s = applyStreakDay(EMPTY_STREAK, '2026-11-01');
    s = applyStreakDay(s, '2026-11-01');
    s = applyStreakDay(s, '2026-11-02');
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });
  it('one missed day is covered by the weekly shield automatically', () => {
    let s = applyStreakDay(EMPTY_STREAK, '2026-11-01'); // Sunday
    s = applyStreakDay(s, '2026-11-03'); // missed Monday
    expect(s.shieldUsed).toBe(true);
    expect(s.current).toBe(2);
    expect(s.shieldsUsedThisWeek).toBe(1);
  });
  it('only one shield per week', () => {
    let s = applyStreakDay(EMPTY_STREAK, '2026-11-01');
    s = applyStreakDay(s, '2026-11-03'); // shield (missed Mon)
    s = applyStreakDay(s, '2026-11-05'); // missed Wed, same week -> reset
    expect(s.shieldUsed).toBe(false);
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });
  it('shield resets in a new week', () => {
    let s = applyStreakDay(EMPTY_STREAK, '2026-11-01');
    s = applyStreakDay(s, '2026-11-03'); // shield in week of 11-01
    s = applyStreakDay(s, '2026-11-04');
    s = applyStreakDay(s, '2026-11-05');
    s = applyStreakDay(s, '2026-11-06');
    s = applyStreakDay(s, '2026-11-07');
    s = applyStreakDay(s, '2026-11-09'); // missed Sun 11-08 -> new week
    expect(s.shieldUsed).toBe(true);
    expect(s.current).toBe(7);
  });
  it('two missed days break the streak', () => {
    let s = applyStreakDay(EMPTY_STREAK, '2026-11-01');
    s = applyStreakDay(s, '2026-11-04');
    expect(s.current).toBe(1);
  });
  it('displayed streak accounts for a pending shield', () => {
    const s = applyStreakDay(EMPTY_STREAK, '2026-11-01');
    expect(displayedStreak(s, '2026-11-02')).toBe(1);
    expect(displayedStreak(s, '2026-11-03')).toBe(1);
    expect(displayedStreak(s, '2026-11-04')).toBe(0);
  });
});

describe('badge rules', () => {
  const at75 = (n: number, hits: number) => Array.from({ length: n }, (_, i) => ({ correct: i < hits }));
  it('Calibrated needs 30+ forecasts at 75% with a hit rate in [65%, 85%]', () => {
    expect(isCalibrated(at75(29, 22))).toBe(false);
    expect(isCalibrated(at75(30, 22))).toBe(true); // 73%
    expect(isCalibrated(at75(40, 26))).toBe(true); // 65%
    expect(isCalibrated(at75(40, 34))).toBe(true); // 85%
    expect(isCalibrated(at75(40, 25))).toBe(false); // 62.5%
    expect(isCalibrated(at75(40, 35))).toBe(false); // 87.5%
  });
  it('Beat the Crowd needs correct + <30% share + >=20 forecasters', () => {
    expect(beatsTheCrowd(true, 5, 20)).toBe(true); // 25%
    expect(beatsTheCrowd(true, 6, 20)).toBe(false); // 30% is not under 30%
    expect(beatsTheCrowd(true, 1, 19)).toBe(false);
    expect(beatsTheCrowd(false, 1, 100)).toBe(false);
  });
  it('duel milestones', () => {
    expect(duelMilestoneBadges(0)).toEqual([]);
    expect(duelMilestoneBadges(1)).toEqual(['DUEL_WIN_1']);
    expect(duelMilestoneBadges(10)).toEqual(['DUEL_WIN_1', 'DUEL_WIN_10']);
    expect(duelMilestoneBadges(50)).toEqual(['DUEL_WIN_1', 'DUEL_WIN_10', 'DUEL_WIN_50']);
  });
  it('season category title: top 1% (at least one) with positive points', () => {
    const ranking = Array.from({ length: 250 }, (_, i) => ({ userId: `u${i}`, points: 1000 - i }));
    expect(categoryTitleHolders(ranking)).toEqual(['u0', 'u1', 'u2']);
    expect(categoryTitleHolders([{ userId: 'a', points: 5 }, { userId: 'b', points: -2 }])).toEqual(['a']);
    expect(categoryTitleHolders([{ userId: 'a', points: 0 }])).toEqual([]);
  });
});
