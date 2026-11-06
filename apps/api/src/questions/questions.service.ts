import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@app/db';
import { crowdShares, endOfRiyadhDay } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { CrowdService } from './crowd.service';
import { options, questionDto, QuestionWith } from './question.mapper';

const PUBLIC_STATUSES = ['LIVE', 'LOCKED', 'RESOLVED', 'FINAL', 'VOID'] as const;

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService, private crowd: CrowdService, private clock: ClockService) {}

  /** LIVE questions, soonest lock first. */
  async feed(user: User | null, categorySlug?: string) {
    const where: Prisma.QuestionWhereInput = { status: 'LIVE', lockAt: { gt: this.clock.now() } };
    if (categorySlug) where.category = { slug: categorySlug };
    const qs = await this.prisma.question.findMany({ where, include: { category: true }, orderBy: { lockAt: 'asc' }, take: 100 });
    return this.decorate(qs, user);
  }

  /** Warm-up: LIVE questions that resolve today (Riyadh), up to 3, preferring the user's interests. */
  async warmup(user: User) {
    const now = this.clock.now();
    const qs = await this.prisma.question.findMany({
      where: { status: 'LIVE', lockAt: { gt: now }, resolveBy: { lte: endOfRiyadhDay(now) } },
      include: { category: true },
      orderBy: { lockAt: 'asc' },
      take: 30,
    });
    qs.sort((a, b) => Number(user.interests.includes(b.category.slug)) - Number(user.interests.includes(a.category.slug)));
    return this.decorate(qs.slice(0, 3), user);
  }

  private async decorate(qs: QuestionWith[], user: User | null) {
    const mine = user ? await this.prisma.forecast.findMany({ where: { userId: user.id, questionId: { in: qs.map((q) => q.id) } } }) : [];
    const byQ = new Map(mine.map((f) => [f.questionId, f]));
    return Promise.all(
      qs.map(async (q) => {
        const f = byQ.get(q.id) ?? null;
        const counts = await this.crowd.counts(q.id);
        const forecasters = Object.values(counts).reduce((a, b) => a + b, 0);
        return questionDto(q, { myForecast: f, forecasters, crowd: f ? crowdShares(counts, options(q).map((o) => o.id)) : null });
      }),
    );
  }

  async detail(id: string, user: User | null) {
    const q = await this.prisma.question.findUnique({ where: { id }, include: { category: true, resolution: true } });
    if (!q || !(PUBLIC_STATUSES as readonly string[]).includes(q.status)) throw notFound();
    const myForecast = user ? await this.prisma.forecast.findUnique({ where: { userId_questionId: { userId: user.id, questionId: id } } }) : null;
    const optionIds = options(q).map((o) => o.id);
    // Crowd is hidden until the user has forecast; after lock the final snapshot is public.
    let crowd = null;
    let forecasters: number;
    const snap = q.crowdSnapshot as { total: number; counts: Record<string, number> } | null;
    if (q.status !== 'LIVE' && snap) {
      crowd = crowdShares(snap.counts, optionIds);
      forecasters = snap.total;
    } else {
      const counts = await this.crowd.counts(id);
      forecasters = Object.values(counts).reduce((a, b) => a + b, 0);
      if (myForecast) crowd = crowdShares(counts, optionIds);
    }
    const myScore = myForecast ? await this.prisma.score.findUnique({ where: { forecastId: myForecast.id } }) : null;
    const myDispute = user ? await this.prisma.dispute.findUnique({ where: { questionId_userId: { questionId: id, userId: user.id } } }) : null;
    return questionDto(q, { myForecast, crowd, forecasters, myScore, myDispute });
  }
}
