import { Injectable } from '@nestjs/common';
import { ACCURACY_WINDOW_DAYS, accuracyRating, DAY_MS, forecastScore, riyadhDay, seasonWindow, weekStart } from '@app/shared';
import { loadConfig } from '../config';
import { ClockService } from '../common/clock.service';
import { DomainEvents, ScoreDelta } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { options } from '../questions/question.mapper';

/**
 * Turns a confirmed resolution into Score rows. Scores are a measure of accuracy only:
 * they are never spent and never move between users.
 */
@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService, private events: DomainEvents, private clock: ClockService) {}

  async ensureSeason(at: Date) {
    const w = seasonWindow(at, loadConfig().SEASON_ANCHOR);
    return this.prisma.season.upsert({ where: { index: w.index }, update: {}, create: { index: w.index, startsAt: w.startsAt, endsAt: w.endsAt } });
  }

  async currentSeason() {
    return this.ensureSeason(this.clock.now());
  }

  /**
   * (Re)scores every forecast on a resolved question. New scores are attributed to the week and
   * season of the first resolution; corrections keep that attribution (DECISIONS #6).
   */
  async scoreQuestion(questionId: string, reason: 'RESOLVED' | 'CORRECTED') {
    const q = await this.prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { resolution: true, forecasts: { include: { score: true } } } });
    if (!q.resolution?.resolvedAt) throw new Error('question not resolved');
    const k = options(q).length;
    const resolvedAt = q.resolution.resolvedAt;
    const season = await this.ensureSeason(resolvedAt);
    const week = weekStart(resolvedAt);
    const deltas: ScoreDelta[] = [];
    const now = this.clock.now();

    for (const f of q.forecasts) {
      const correct = f.optionId === q.resolution.winningOptionId;
      const points = forecastScore(f.confidence, correct, k);
      const before = f.score?.points ?? null;
      if (f.score) {
        if (f.score.points !== points || f.score.correct !== correct) await this.prisma.score.update({ where: { id: f.score.id }, data: { points, correct, scoredAt: now } });
        deltas.push({ userId: f.userId, forecastId: f.id, categoryId: q.categoryId, seasonId: f.score.seasonId, weekStart: f.score.weekStart, before, after: points, delta: points - (before ?? 0) });
      } else {
        await this.prisma.score.create({
          data: { forecastId: f.id, userId: f.userId, questionId, seasonId: season.id, categoryId: q.categoryId, weekStart: week, points, correct, confidence: f.confidence, scoredAt: now },
        });
        deltas.push({ userId: f.userId, forecastId: f.id, categoryId: q.categoryId, seasonId: season.id, weekStart: week, before: null, after: points, delta: points });
      }
    }
    await this.events.emit('question.scored', { questionId, reason, deltas });
    return deltas;
  }

  /** Voided questions score nothing for anyone: remove any scores. */
  async unscoreQuestion(questionId: string) {
    const scores = await this.prisma.score.findMany({ where: { questionId } });
    await this.prisma.score.deleteMany({ where: { questionId } });
    const deltas: ScoreDelta[] = scores.map((s) => ({ userId: s.userId, forecastId: s.forecastId, categoryId: s.categoryId, seasonId: s.seasonId, weekStart: s.weekStart, before: s.points, after: null, delta: -s.points }));
    await this.events.emit('question.scored', { questionId, reason: 'VOIDED', deltas });
    return deltas;
  }

  async stats(userId: string) {
    const now = this.clock.now();
    const season = await this.currentSeason();
    const week = weekStart(now);
    const [seasonAgg, weekScores, total, windowScores] = await Promise.all([
      this.prisma.score.aggregate({ where: { userId, seasonId: season.id }, _sum: { points: true } }),
      this.prisma.score.findMany({ where: { userId, weekStart: week }, select: { points: true, scoredAt: true } }),
      this.prisma.score.count({ where: { userId } }),
      this.prisma.score.findMany({ where: { userId, scoredAt: { gte: new Date(now.getTime() - ACCURACY_WINDOW_DAYS * DAY_MS) } }, select: { points: true } }),
    ]);
    return {
      season: { id: season.id, index: season.index, startsAt: season.startsAt, endsAt: season.endsAt },
      seasonPoints: seasonAgg._sum.points ?? 0,
      weekPoints: weekScores.reduce((a, x) => a + x.points, 0),
      /** points per Riyadh day of the current week (Sunday first), for the weekly chart */
      weekDaily: Array.from({ length: 7 }, (_, i) => {
        const day = riyadhDay(new Date(week.getTime() + i * DAY_MS));
        return weekScores.filter((x) => riyadhDay(x.scoredAt) === day).reduce((a, x) => a + x.points, 0);
      }),
      scoredForecasts: total,
      accuracy: accuracyRating(total, windowScores.map((s) => s.points)),
    };
  }
}
