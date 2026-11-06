import type { Option } from './types';

export interface DuelQ {
  order: number;
  pickedBy: 'CHALLENGER' | 'OPPONENT' | 'SYSTEM';
  question: { id: string; textAr: string; textEn: string; options: Option[]; lockAt: string; status: string };
  challengerOptionId: string | null;
  opponentOptionId: string | null;
  winningOptionId: string | null;
}
export interface DuelDto {
  id: string;
  format: 'SINGLE' | 'BEST_OF_3';
  status: 'PENDING' | 'ACTIVE' | 'DONE' | 'VOID' | 'EXPIRED';
  challenger: { nickname: string };
  opponent: { nickname: string } | null;
  directed: boolean;
  mySide: 'challenger' | 'opponent' | null;
  winner: 'CHALLENGER' | 'OPPONENT' | null;
  score: { challenger: number; opponent: number } | null;
  myEloDelta: number | null;
  expiresAt: string;
  questions: DuelQ[];
}

export function duelResultKey(d: DuelDto) {
  if (d.status !== 'DONE') return null;
  if (!d.winner) return 'duels.tie';
  const iWon = (d.winner === 'CHALLENGER') === (d.mySide === 'challenger');
  return iWon ? 'duels.won' : 'duels.lost';
}
