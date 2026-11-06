export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';

export interface QuestionOption {
  id: string;
  labelAr: string;
  labelEn: string;
}
