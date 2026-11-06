import { describe, expect, it } from 'vitest';
import { challengerEloResult, duelOutcome, eloUpdate, ELO_START, expectedScore } from '../src';

const q = (winning: string | null | 'VOID', c: string | null, o: string | null) => ({ winningOptionId: winning, challengerOptionId: c, opponentOptionId: o });

describe('duelOutcome — SINGLE', () => {
  it('challenger wins when they picked the winning option', () => {
    expect(duelOutcome([q('yes', 'yes', 'no')])).toMatchObject({ state: 'DONE', winner: 'CHALLENGER' });
  });
  it('opponent wins when they picked the winning option', () => {
    expect(duelOutcome([q('no', 'yes', 'no')])).toMatchObject({ state: 'DONE', winner: 'OPPONENT' });
  });
  it('tie when neither picked the winning option (e.g. draw in a 3-way match)', () => {
    expect(duelOutcome([q('draw', 'home', 'away')])).toMatchObject({ state: 'DONE', winner: null });
  });
  it('void question -> VOID duel', () => {
    expect(duelOutcome([q('VOID', 'home', 'away')])).toEqual({ state: 'VOID' });
  });
  it('pending while unresolved', () => {
    expect(duelOutcome([q(null, 'home', 'away')])).toEqual({ state: 'PENDING' });
  });
});

describe('duelOutcome — BEST_OF_3', () => {
  it('more wins wins', () => {
    expect(duelOutcome([q('a', 'a', 'b'), q('b', 'a', 'b'), q('a', 'a', 'b')])).toMatchObject({ winner: 'CHALLENGER', challengerWins: 2, opponentWins: 1 });
  });
  it('equal wins is a tie (one question where both picked the same)', () => {
    expect(duelOutcome([q('a', 'a', 'b'), q('b', 'a', 'b'), q('a', 'a', 'a')])).toMatchObject({ state: 'DONE', winner: null, challengerWins: 1, opponentWins: 1 });
  });
  it('a voided question counts as no result', () => {
    expect(duelOutcome([q('a', 'a', 'b'), q('VOID', 'a', 'b'), q('b', 'b', 'b')])).toMatchObject({ state: 'DONE', winner: 'CHALLENGER', challengerWins: 1, opponentWins: 0 });
  });
  it('void + tie leaves a tie', () => {
    expect(duelOutcome([q('a', 'a', 'b'), q('b', 'a', 'b'), q('VOID', 'a', 'b')])).toMatchObject({ state: 'DONE', winner: null });
  });
  it('all voided -> VOID', () => {
    expect(duelOutcome([q('VOID', 'a', 'b'), q('VOID', 'a', 'b'), q('VOID', 'a', 'b')])).toEqual({ state: 'VOID' });
  });
  it('missing answer counts as not picking the winner', () => {
    expect(duelOutcome([q('a', 'a', 'b'), q('b', null, 'b'), q('a', null, null)])).toMatchObject({ winner: null, challengerWins: 1, opponentWins: 1 });
  });
  it('waits for every question', () => {
    expect(duelOutcome([q('a', 'a', 'b'), q('a', 'a', 'b'), q(null, 'a', 'b')])).toEqual({ state: 'PENDING' });
  });
});

describe('Elo', () => {
  it('starts at 1200 with K=32', () => {
    expect(ELO_START).toBe(1200);
    expect(eloUpdate(1200, 1200, 1)).toEqual({ a: 1216, b: 1184, deltaA: 16, deltaB: -16 });
  });
  it('tie between equals changes nothing; tie vs stronger gains', () => {
    expect(eloUpdate(1200, 1200, 0.5)).toMatchObject({ deltaA: 0, deltaB: 0 });
    const r = eloUpdate(1200, 1400, 0.5);
    expect(r.deltaA).toBe(8);
    expect(r.deltaB).toBe(-8);
  });
  it('upset win gives a bigger gain', () => {
    expect(eloUpdate(1200, 1400, 1).deltaA).toBe(24);
    expect(eloUpdate(1400, 1200, 1).deltaA).toBe(8);
  });
  it('expected scores sum to 1', () => {
    expect(expectedScore(1300, 1100) + expectedScore(1100, 1300)).toBeCloseTo(1);
  });
  it('maps outcomes to results', () => {
    expect(challengerEloResult({ state: 'DONE', winner: 'CHALLENGER', challengerWins: 1, opponentWins: 0 })).toBe(1);
    expect(challengerEloResult({ state: 'DONE', winner: 'OPPONENT', challengerWins: 0, opponentWins: 1 })).toBe(0);
    expect(challengerEloResult({ state: 'DONE', winner: null, challengerWins: 0, opponentWins: 0 })).toBe(0.5);
  });
});
