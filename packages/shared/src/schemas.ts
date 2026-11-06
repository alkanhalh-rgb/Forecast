import { z } from 'zod';
import { CONFIDENCE_LEVELS } from './scoring';
import { ATTESTATIONS } from './topics';

export const SAUDI_CITIES = [
  'riyadh', 'jeddah', 'makkah', 'madinah', 'dammam', 'khobar', 'dhahran', 'taif', 'tabuk', 'abha',
  'buraidah', 'hail', 'jazan', 'najran', 'al_ahsa', 'jubail', 'yanbu', 'khamis_mushait', 'al_baha', 'arar', 'sakaka', 'other',
] as const;

export const phoneSchema = z.object({ phone: z.string().min(9).max(20) });
export const verifySchema = z.object({ phone: z.string().min(9).max(20), code: z.string().regex(/^\d{6}$/) });

export const NICKNAME_RE = /^[\p{L}\p{N}_]{3,20}$/u;
export const nicknameSchema = z.string().trim().regex(NICKNAME_RE, 'nickname must be 3-20 letters, digits or _');

export const ageConsentSchema = z.object({ confirm18: z.literal(true), acceptPrivacy: z.literal(true) });
export const profileSchema = z.object({ nickname: nicknameSchema, city: z.enum(SAUDI_CITIES) });
export const interestsSchema = z.object({ interests: z.array(z.string().min(1)).length(3) });

export const confidenceSchema = z.union([z.literal(CONFIDENCE_LEVELS[0]), z.literal(CONFIDENCE_LEVELS[1]), z.literal(CONFIDENCE_LEVELS[2])]);
export const forecastSchema = z.object({ questionId: z.string().min(1), optionId: z.string().min(1), confidence: confidenceSchema });

export const optionInputSchema = z.object({ labelAr: z.string().trim().min(1).max(120), labelEn: z.string().trim().min(1).max(120) });
export const questionInputSchema = z.object({
  categoryId: z.string().min(1),
  textAr: z.string().trim().min(8).max(300),
  textEn: z.string().trim().min(8).max(300),
  options: z.array(optionInputSchema).min(2).max(6),
  lockAt: z.coerce.date(),
  resolveBy: z.coerce.date(),
  sourceName: z.string().trim().min(2).max(120),
  sourceUrl: z.string().trim().url(),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const attestationSchema = z.object(Object.fromEntries(ATTESTATIONS.map((a) => [a, z.boolean()])) as Record<(typeof ATTESTATIONS)[number], z.ZodBoolean>);

export const VOID_REASONS = ['POSTPONED', 'ABANDONED', 'SOURCE_UNAVAILABLE_48H', 'AMBIGUOUS'] as const;
export type VoidReason = (typeof VOID_REASONS)[number];
export const voidSchema = z.object({ reason: z.enum(VOID_REASONS), note: z.string().max(500).optional() });

export const resolveSchema = z.object({ winningOptionId: z.string().min(1), sourceUrl: z.string().url() });
export const correctionSchema = z.object({ winningOptionId: z.string().min(1), sourceUrl: z.string().url(), correctionNote: z.string().trim().min(5).max(500) });

export const disputeSchema = z.object({ evidenceUrl: z.string().url(), message: z.string().trim().min(5).max(1000) });
export const disputeDecisionSchema = z.object({ decision: z.enum(['UPHELD', 'REJECTED']), note: z.string().trim().min(2).max(1000) });

export const duelCreateSchema = z.object({
  format: z.enum(['SINGLE', 'BEST_OF_3']),
  questionId: z.string().min(1),
  optionId: z.string().min(1),
  opponentNickname: z.string().trim().optional(),
});
export const duelAcceptSchema = z.object({
  optionId: z.string().min(1),
  q2QuestionId: z.string().min(1).optional(),
  q2OptionId: z.string().min(1).optional(),
});
export const duelAnswerSchema = z.object({ order: z.number().int().min(1).max(3), optionId: z.string().min(1) });

export const friendLeagueCreateSchema = z.object({ name: z.string().trim().min(2).max(40) });
