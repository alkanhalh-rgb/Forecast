import type { Category, Dispute, Forecast, Question, Resolution, Score } from '@app/db';
import type { QuestionOption } from '@app/db';

export type QuestionWith = Question & { category: Category; resolution?: Resolution | null };

export const DISPUTE_WINDOW_MS = 12 * 3600_000;

export function options(q: Question): QuestionOption[] {
  return q.options as unknown as QuestionOption[];
}

/** Public view of a question. Crowd data is only included when the caller is allowed to see it. */
export function questionDto(
  q: QuestionWith,
  extra: {
    myForecast?: Forecast | null;
    crowd?: { total: number; shares: Record<string, number> } | null;
    forecasters?: number;
    myScore?: Score | null;
    myDispute?: Dispute | null;
  } = {},
) {
  const r = q.resolution;
  const showResolution = r && r.resolvedAt && q.status !== 'VOID';
  return {
    id: q.id,
    category: q.category,
    textAr: q.textAr,
    textEn: q.textEn,
    options: options(q),
    lockAt: q.lockAt,
    resolveBy: q.resolveBy,
    sourceName: q.sourceName,
    sourceUrl: q.sourceUrl,
    status: q.status,
    publishedAt: q.publishedAt,
    forecasters: extra.forecasters,
    myForecast: extra.myForecast ? { optionId: extra.myForecast.optionId, confidence: extra.myForecast.confidence, updatedAt: extra.myForecast.updatedAt } : null,
    crowd: extra.crowd ?? null,
    resolution: showResolution
      ? { winningOptionId: r.winningOptionId, sourceUrl: r.sourceUrl, resolvedAt: r.resolvedAt, finalizedAt: r.finalizedAt, correctionNote: r.correctionNote }
      : null,
    myScore: extra.myScore ? { points: extra.myScore.points, correct: extra.myScore.correct } : null,
    voidReason: q.status === 'VOID' ? q.voidReason : null,
    disputeUntil: q.status === 'RESOLVED' && r?.resolvedAt ? new Date(r.resolvedAt.getTime() + DISPUTE_WINDOW_MS) : null,
    myDispute: !!extra.myDispute,
  };
}
