export type DuelFormat = 'SINGLE' | 'BEST_OF_3';
export type DuelStatus = 'PENDING' | 'ACTIVE' | 'DONE' | 'VOID' | 'EXPIRED';

export const DUEL_PAIR_WEEKLY_LIMIT = 3;

export interface DuelQuestionOutcome {
  /** null while unresolved; 'VOID' when the question was voided. */
  winningOptionId: string | null | 'VOID';
  challengerOptionId: string | null;
  opponentOptionId: string | null;
}

export type QuestionResult = 'CHALLENGER' | 'OPPONENT' | 'NONE' | 'NO_RESULT' | 'PENDING';

/** Who won one duel question. NONE = neither (or both) picked the winning option; NO_RESULT = voided. */
export function duelQuestionResult(q: DuelQuestionOutcome): QuestionResult {
  if (q.winningOptionId === null) return 'PENDING';
  if (q.winningOptionId === 'VOID') return 'NO_RESULT';
  const c = q.challengerOptionId === q.winningOptionId;
  const o = q.opponentOptionId === q.winningOptionId;
  if (c && !o) return 'CHALLENGER';
  if (o && !c) return 'OPPONENT';
  return 'NONE';
}

export type DuelOutcome =
  | { state: 'PENDING' }
  | { state: 'VOID' }
  | { state: 'DONE'; winner: 'CHALLENGER' | 'OPPONENT' | null; challengerWins: number; opponentWins: number };

/**
 * SINGLE: whoever picked the winning option wins; neither -> tie; void -> VOID.
 * BEST_OF_3: more question wins among resolved (non-void) questions wins; equal -> tie;
 * no non-void questions left -> VOID. Decided only when every question is resolved or void.
 */
export function duelOutcome(questions: DuelQuestionOutcome[]): DuelOutcome {
  const results = questions.map(duelQuestionResult);
  if (results.some((r) => r === 'PENDING')) return { state: 'PENDING' };
  const counted = results.filter((r) => r !== 'NO_RESULT');
  if (counted.length === 0) return { state: 'VOID' };
  const challengerWins = counted.filter((r) => r === 'CHALLENGER').length;
  const opponentWins = counted.filter((r) => r === 'OPPONENT').length;
  const winner = challengerWins > opponentWins ? 'CHALLENGER' : opponentWins > challengerWins ? 'OPPONENT' : null;
  return { state: 'DONE', winner, challengerWins, opponentWins };
}

/** Elo result for the challenger from a DONE outcome. */
export function challengerEloResult(o: Extract<DuelOutcome, { state: 'DONE' }>): 0 | 0.5 | 1 {
  return o.winner === 'CHALLENGER' ? 1 : o.winner === 'OPPONENT' ? 0 : 0.5;
}
