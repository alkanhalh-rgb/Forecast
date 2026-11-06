/**
 * Vocabulary that must never appear in UI copy, code or comments (CLAUDE.md rule 4).
 * This is the ONLY source file allowed to contain these words; the scanner test excludes it.
 */
export const BANNED_WORDS_EN = ['odds', 'bet', 'bets', 'betting', 'bettor', 'stake', 'stakes', 'staked', 'staking', 'wager', 'wagers', 'wagering', 'payout', 'payouts', 'jackpot', 'jackpots', 'gamble', 'gambling'];
export const BANNED_WORDS_AR = ['رهان', 'مراهنة', 'يراهن', 'قمار', 'مقامرة'];

const EN_RE = new RegExp(`\\b(${BANNED_WORDS_EN.join('|')})\\b`, 'i');

/** Returns the banned words found in `text` (empty array when clean). */
export function findBannedWords(text: string): string[] {
  const found = new Set<string>();
  const enGlobal = new RegExp(EN_RE.source, 'gi');
  for (const m of text.matchAll(enGlobal)) found.add(m[1]!.toLowerCase());
  for (const w of BANNED_WORDS_AR) if (text.includes(w)) found.add(w);
  return [...found];
}

export function hasBannedWords(text: string): boolean {
  return findBannedWords(text).length > 0;
}

/** Stricter check for short identifiers such as nicknames ("jackpot_king", "BigWager1"). */
export function identifierHasBannedWords(text: string): boolean {
  const spaced = text.replace(/[_\d]+/g, ' ');
  if (hasBannedWords(spaced)) return true;
  const lower = text.toLowerCase();
  return BANNED_WORDS_EN.filter((w) => w.length >= 5).some((w) => lower.includes(w));
}
