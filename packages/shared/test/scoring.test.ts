import { describe, expect, it } from 'vitest';
import { accuracyRating, canForecast, crowdShares, forecastScore, sumPoints } from '../src';

describe('forecastScore (yes/no, k = 2) — exact values from the spec', () => {
  it.each([
    [60, true, 26],
    [60, false, -32],
    [75, true, 58],
    [75, false, -100],
    [90, true, 85],
    [90, false, -232],
  ])('confidence %i, correct=%s -> %i', (conf, correct, expected) => {
    expect(forecastScore(conf, correct, 2)).toBe(expected);
  });
});

describe('forecastScore (k > 2)', () => {
  it('uses baseline 1/k and spreads the miss across k-1 options', () => {
    // k=3: right at 60% -> log2(0.6*3)=0.848 -> 85 ; wrong -> p=0.2 -> log2(0.6) = -0.737 -> -74
    expect(forecastScore(60, true, 3)).toBe(85);
    expect(forecastScore(60, false, 3)).toBe(-74);
    expect(forecastScore(90, false, 3)).toBe(Math.round(100 * Math.log2(0.05 * 3)));
  });
  it('rejects invalid confidence or option count', () => {
    expect(() => forecastScore(50, true, 2)).toThrow();
    expect(() => forecastScore(60, true, 1)).toThrow();
  });
});

describe('season points and accuracy', () => {
  it('season points are the sum of scores', () => {
    expect(sumPoints([{ points: 26 }, { points: -32 }, { points: 85 }])).toBe(79);
  });
  it('accuracy hidden below 20 scored forecasts', () => {
    expect(accuracyRating(19, [10, 20])).toBeNull();
  });
  it('accuracy is the average over the window once >= 20', () => {
    expect(accuracyRating(20, [26, -32, 58])).toBe(17);
    expect(accuracyRating(25, [])).toBeNull();
  });
});

describe('canForecast (server-side lock rule)', () => {
  const lockAt = new Date('2026-11-06T12:00:00Z');
  it('accepts strictly before lockAt while LIVE', () => {
    expect(canForecast({ status: 'LIVE', lockAt }, new Date(lockAt.getTime() - 1))).toEqual({ ok: true });
  });
  it('rejects at or after lockAt even if the status is still LIVE', () => {
    expect(canForecast({ status: 'LIVE', lockAt }, lockAt)).toEqual({ ok: false, reason: 'LOCKED' });
    expect(canForecast({ status: 'LIVE', lockAt }, new Date(lockAt.getTime() + 1000))).toEqual({ ok: false, reason: 'LOCKED' });
  });
  it('rejects non-LIVE questions', () => {
    expect(canForecast({ status: 'LOCKED', lockAt }, new Date(0))).toEqual({ ok: false, reason: 'LOCKED' });
    expect(canForecast({ status: 'DRAFT', lockAt }, new Date(0))).toEqual({ ok: false, reason: 'NOT_LIVE' });
    expect(canForecast({ status: 'VOID', lockAt }, new Date(0))).toEqual({ ok: false, reason: 'NOT_LIVE' });
  });
});

describe('crowdShares', () => {
  it('computes shares and handles empty', () => {
    expect(crowdShares({ a: 3, b: 1 }, ['a', 'b'])).toEqual({ total: 4, shares: { a: 0.75, b: 0.25 } });
    expect(crowdShares({}, ['a', 'b'])).toEqual({ total: 0, shares: { a: 0, b: 0 } });
  });
});
