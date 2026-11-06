import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@app/db';
import { applyStreakDay, beatsTheCrowd, categoryTitleHolders, displayedStreak, duelMilestoneBadges, isCalibrated, riyadhDay, StreakState, weekKey } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { DomainEvents } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { SweeperService } from '../jobs/sweeper.service';
import { options } from '../questions/question.mapper';
import { ShareCardsService } from './share-cards.service';

/** Streaks (with weekly shield) and badges. Badges are status only: they unlock nothing. */
@Injectable()
export class AchievementsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private events: DomainEvents,
    private sweeper: SweeperService,
    private cards: ShareCardsService,
  ) {}

  onModuleInit() {
    this.events.on('forecast.saved', (e) => this.recordStreakDay(e.userId, e.at));
    this.events.on('question.scored', (e) => (e.reason === 'VOIDED' ? this.revokeCrowdBadges(e.questionId) : this.onScored(e.questionId)));
    this.events.on('duel.decided', (e) => this.onDuelDecided(e.duelId));
    this.sweeper.register('seasonClose', () => this.closeDueSeasons());
  }

  // ----- streaks -----
  async recordStreakDay(userId: string, at: Date) {
    const s = await this.prisma.streak.findUnique({ where: { userId } });
    const state: StreakState = s ?? { current: 0, best: 0, lastActiveDay: null, shieldsUsedThisWeek: 0, shieldWeek: null };
    const next = applyStreakDay(state, riyadhDay(at));
    const data = { current: next.current, best: next.best, lastActiveDay: next.lastActiveDay, shieldsUsedThisWeek: next.shieldsUsedThisWeek, shieldWeek: next.shieldWeek };
    await this.prisma.streak.upsert({ where: { userId }, update: data, create: { userId, ...data } });
    return next;
  }

  async streak(userId: string) {
    const s = await this.prisma.streak.findUnique({ where: { userId } });
    const now = this.clock.now();
    if (!s) return { current: 0, best: 0, shieldAvailable: true };
    return { current: displayedStreak(s, riyadhDay(now)), best: s.best, shieldAvailable: !(s.shieldWeek === weekKey(now) && s.shieldsUsedThisWeek >= 1) };
  }

  // ----- badges -----
  private async award(userId: string, badge: string, awardKey: string, meta?: Prisma.InputJsonValue) {
    const existing = await this.prisma.badgeAward.findUnique({ where: { userId_awardKey: { userId, awardKey } } });
    if (existing) return null;
    return this.prisma.badgeAward.create({ data: { userId, badge, awardKey, meta, awardedAt: this.clock.now() } });
  }

  private async onScored(questionId: string) {
    const q = await this.prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { resolution: true, scores: true } });
    const snap = q.crowdSnapshot as { total: number; counts: Record<string, number> } | null;
    const winning = q.resolution?.winningOptionId;
    const label = options(q).find((o) => o.id === winning);
    for (const s of q.scores) {
      // Beat the Crowd: correct on an option that under 30% of >= 20 forecasters chose (snapshot at lock)
      const key = `BEAT_THE_CROWD:${questionId}`;
      const f = await this.prisma.forecast.findUnique({ where: { id: s.forecastId }, include: { user: { select: { nickname: true } } } });
      const ok = !!snap && !!f && beatsTheCrowd(s.correct, snap.counts[f.optionId] ?? 0, snap.total);
      if (ok) {
        const a = await this.award(s.userId, 'BEAT_THE_CROWD', key, { questionId, share: (snap!.counts[f!.optionId] ?? 0) / snap!.total });
        if (a)
          await this.cards.enqueue(s.userId, 'BEAT_THE_CROWD', questionId, {
            nickname: f!.user.nickname ?? '',
            headlineAr: 'تفوّقت على الجمهور',
            headlineEn: 'Beat the crowd',
            detailAr: `${q.textAr} — ${label?.labelAr ?? ''}`,
            detailEn: `${q.textEn} — ${label?.labelEn ?? ''}`,
          });
      } else await this.prisma.badgeAward.deleteMany({ where: { userId: s.userId, awardKey: key } }); // after a correction
      // Calibrated
      const at75 = await this.prisma.score.findMany({ where: { userId: s.userId, confidence: 75 }, select: { correct: true } });
      if (isCalibrated(at75)) await this.award(s.userId, 'CALIBRATED', 'CALIBRATED');
    }
  }

  private async revokeCrowdBadges(questionId: string) {
    await this.prisma.badgeAward.deleteMany({ where: { awardKey: `BEAT_THE_CROWD:${questionId}` } });
  }

  private async onDuelDecided(duelId: string) {
    const d = await this.prisma.duel.findUnique({ where: { id: duelId }, include: { questions: { include: { question: true }, orderBy: { order: 'asc' } }, challenger: true, opponent: true } });
    if (!d || d.status !== 'DONE' || !d.winnerId) return;
    const r = await this.prisma.duelRating.findUnique({ where: { userId: d.winnerId } });
    for (const b of duelMilestoneBadges(r?.wins ?? 0)) await this.award(d.winnerId, b, b);
    const winner = d.winnerId === d.challengerId ? d.challenger : d.opponent!;
    const loser = d.winnerId === d.challengerId ? d.opponent! : d.challenger;
    const q = d.questions[0]!.question;
    await this.cards.enqueue(d.winnerId, 'DUEL_WIN', d.id, {
      nickname: winner.nickname ?? '',
      headlineAr: 'فزت بالتحدي!',
      headlineEn: 'Challenge won!',
      detailAr: `ضد ${loser.nickname} — ${q.textAr}`,
      detailEn: `vs ${loser.nickname} — ${q.textEn}`,
    });
  }

  /** At season end, the top 1% in each category earn the season category title. */
  async closeDueSeasons() {
    const due = await this.prisma.season.findMany({ where: { closedAt: null, endsAt: { lte: this.clock.now() } } });
    for (const s of due) {
      const rows = await this.prisma.score.groupBy({ by: ['categoryId', 'userId'], where: { seasonId: s.id }, _sum: { points: true } });
      const byCat = new Map<string, { userId: string; points: number }[]>();
      for (const r of rows) byCat.set(r.categoryId, [...(byCat.get(r.categoryId) ?? []), { userId: r.userId, points: r._sum.points ?? 0 }]);
      for (const [categoryId, ranking] of byCat)
        for (const userId of categoryTitleHolders(ranking)) await this.award(userId, 'SEASON_CATEGORY_TITLE', `SEASON_CATEGORY_TITLE:${s.id}:${categoryId}`, { seasonId: s.id, seasonIndex: s.index, categoryId });
      await this.prisma.season.update({ where: { id: s.id }, data: { closedAt: this.clock.now() } });
    }
    return { closed: due.length };
  }

  badges(userId: string) {
    return this.prisma.badgeAward.findMany({ where: { userId }, orderBy: { awardedAt: 'desc' } });
  }
}
