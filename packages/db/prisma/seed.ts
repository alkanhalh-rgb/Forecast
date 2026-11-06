import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const CATEGORIES = [
  { slug: 'spl', nameAr: 'دوري روشن السعودي', nameEn: 'Saudi Pro League' },
  { slug: 'tadawul', nameAr: 'تداول', nameEn: 'Tadawul' },
  { slug: 'oil', nameAr: 'النفط', nameEn: 'Oil' },
  { slug: 'weather', nameAr: 'الطقس', nameEn: 'Weather' },
  { slug: 'events', nameAr: 'فعاليات', nameEn: 'Events' },
  { slug: 'tech', nameAr: 'تقنية', nameEn: 'Tech' },
];

async function main() {
  for (const c of CATEGORIES) await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  console.log(`seeded ${CATEGORIES.length} categories`);
}

main().finally(() => prisma.$disconnect());
