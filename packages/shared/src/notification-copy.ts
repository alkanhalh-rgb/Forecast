/** Server-side notification copy (bilingual). Push payloads carry Arabic first, English second. */
export type NotificationKind = 'RESOLUTION' | 'VOID' | 'CORRECTION' | 'DUEL_CHALLENGE' | 'DUEL_RESULT' | 'DISPUTE_DECISION';

export const NOTIFICATION_COPY: Record<NotificationKind, { titleAr: string; titleEn: string }> = {
  RESOLUTION: { titleAr: 'حُسم سؤال توقعته', titleEn: 'A question you forecast was resolved' },
  VOID: { titleAr: 'أُلغي سؤال توقعته', titleEn: 'A question you forecast was voided' },
  CORRECTION: { titleAr: 'تصحيح نتيجة', titleEn: 'Result corrected' },
  DUEL_CHALLENGE: { titleAr: 'لديك تحدٍّ جديد', titleEn: 'You have a new challenge' },
  DUEL_RESULT: { titleAr: 'انتهى تحدٍّ', titleEn: 'A challenge has finished' },
  DISPUTE_DECISION: { titleAr: 'قرار بشأن بلاغك', titleEn: 'Decision on your report' },
};
