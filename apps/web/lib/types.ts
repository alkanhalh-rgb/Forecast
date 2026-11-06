export interface Option {
  id: string;
  labelAr: string;
  labelEn: string;
}
export interface Category {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}
export interface QuestionDto {
  id: string;
  category: Category;
  textAr: string;
  textEn: string;
  options: Option[];
  lockAt: string;
  resolveBy: string;
  sourceName: string;
  sourceUrl: string;
  status: 'DRAFT' | 'REVIEW' | 'LIVE' | 'LOCKED' | 'RESOLVED' | 'FINAL' | 'VOID';
  publishedAt: string | null;
  forecasters?: number;
  myForecast: { optionId: string; confidence: number; updatedAt: string } | null;
  crowd: { total: number; shares: Record<string, number> } | null;
  resolution?: { winningOptionId: string; sourceUrl: string; resolvedAt: string | null; finalizedAt: string | null; correctionNote: string | null } | null;
  myScore?: { points: number; correct: boolean } | null;
  voidReason?: string | null;
  disputeUntil?: string | null;
  myDispute?: boolean;
}
