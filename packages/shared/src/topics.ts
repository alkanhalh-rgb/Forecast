import { findBannedWords } from './banned-words';

/**
 * Blocked topics (publish checklist): deaths, injuries, accidents, crimes, religious matters,
 * politics, government decisions, the royal family, named private individuals, and anything
 * people might want to cause. Keyword scan is a first filter; editors and reviewers also attest.
 */
export const BLOCKED_TOPIC_KEYWORDS: Record<string, string[]> = {
  death: ['death', 'deaths', 'die', 'dies', 'died', 'dead', 'killed', 'وفاة', 'يموت', 'موت', 'مقتل', 'وفيات'],
  injury: ['injury', 'injuries', 'injured', 'إصابة', 'مصاب', 'إصابات'],
  accident: ['accident', 'accidents', 'crash', 'حادث', 'حوادث', 'تصادم'],
  crime: ['crime', 'crimes', 'arrest', 'arrested', 'murder', 'theft', 'جريمة', 'اعتقال', 'سرقة', 'قتل'],
  religion: ['religion', 'religious', 'fatwa', 'ديني', 'دينية', 'فتوى'],
  politics: ['election', 'elections', 'politics', 'political', 'minister', 'parliament', 'sanctions', 'انتخابات', 'سياسي', 'سياسة', 'وزير', 'عقوبات'],
  government: ['government decision', 'decree', 'royal decree', 'قرار حكومي', 'مرسوم', 'أمر ملكي'],
  royal: ['royal family', 'king', 'crown prince', 'prince', 'princess', 'الأسرة المالكة', 'ولي العهد', 'الملك', 'الأمير'],
};

export function findBlockedTopics(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const hits: string[] = [];
  for (const [topic, words] of Object.entries(BLOCKED_TOPIC_KEYWORDS)) {
    if (words.some((w) => (/[a-z]/.test(w) ? new RegExp(`\\b${w}\\b`, 'i').test(lower) : lower.includes(w)))) hits.push(topic);
  }
  return hits;
}

export interface ChecklistInput {
  textAr: string;
  textEn: string;
  options: { labelAr: string; labelEn: string }[];
  sourceName: string;
  sourceUrl: string;
  lockAt: Date;
  resolveBy: Date;
}

export const ATTESTATIONS = ['lockBeforeOutcomePublic', 'notBlockedTopic', 'neutralWording', 'optionsExclusiveExhaustive'] as const;
export type Attestation = (typeof ATTESTATIONS)[number];

export type AutoCheck = 'sourceNamed' | 'sourceUrlValid' | 'resolvesWithin24h' | 'lockInFuture' | 'lockBeforeResolve' | 'noBannedWords' | 'noBlockedKeywords' | 'optionsValid';

export const MAX_RESOLVE_HOURS = 24;

/** Automatic part of the publish checklist. `publishAt` is the (intended) publish time. */
export function autoChecklist(q: ChecklistInput, publishAt: Date): Record<AutoCheck, boolean> {
  let urlOk = false;
  try {
    const u = new URL(q.sourceUrl);
    urlOk = u.protocol === 'https:' && !!u.hostname.includes('.');
  } catch {
    urlOk = false;
  }
  const allText = [q.textAr, q.textEn, ...q.options.flatMap((o) => [o.labelAr, o.labelEn])].join(' \n ');
  const labelsAr = q.options.map((o) => o.labelAr.trim());
  const labelsEn = q.options.map((o) => o.labelEn.trim().toLowerCase());
  const optionsValid =
    q.options.length >= 2 &&
    q.options.length <= 6 &&
    labelsAr.every(Boolean) &&
    labelsEn.every(Boolean) &&
    new Set(labelsAr).size === labelsAr.length &&
    new Set(labelsEn).size === labelsEn.length;
  return {
    sourceNamed: q.sourceName.trim().length >= 2,
    sourceUrlValid: urlOk,
    resolvesWithin24h: q.resolveBy.getTime() - publishAt.getTime() <= MAX_RESOLVE_HOURS * 3600_000,
    lockInFuture: q.lockAt.getTime() > publishAt.getTime(),
    lockBeforeResolve: q.lockAt.getTime() <= q.resolveBy.getTime(),
    noBannedWords: findBannedWords(allText).length === 0,
    noBlockedKeywords: findBlockedTopics(allText).length === 0,
    optionsValid,
  };
}

export function checklistPasses(auto: Record<AutoCheck, boolean>, attest: Partial<Record<Attestation, boolean>>): boolean {
  return Object.values(auto).every(Boolean) && ATTESTATIONS.every((a) => attest[a] === true);
}
