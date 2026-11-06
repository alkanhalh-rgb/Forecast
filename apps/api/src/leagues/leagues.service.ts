import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GROUP_SIZE, MIN_DIVISION, nextDivision, rankGroup, weekKey, weekStart, WEEK_MS } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { DomainEvents, ScoreDelta } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { QueueService, QUEUES } from '../jobs/queue.service';
import { SweeperService } from '../jobs/sweeper.service';

export const lbKeys = {
  week: (ws: Date) => `lb:week:${weekKey(ws)}`,
  season: (seasonId: string) => `lb:season:${seasonId}`,
  category: (seasonId: string, categoryId: string) => `lb:season:${seasonId}:cat:${categoryId}`,
};

/**
 * Weekly leagues: 5 divisions, groups of 30, ranked by weekly points. At Sunday 00:00 Riyadh the
 * top 5 of each group move up and the bottom 5 move down. Leaderboards are Redis sorted sets.
 */
@Injectable()
export class LeaguesService implements OnModuleInit {
  private log = new Logger('Leagues');

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private clock: ClockService,
    private events: DomainEvents,
    private queues: QueueService,
    private sweeper: SweeperService,
  ) {}

  onModuleInit() {
    this.events.on('forecast.saved', (e) => this.join(e.userId, e.at));
    this.events.on('question.scored', (e) => this.applyDeltas(e.deltas));
    this.queues.register(QUEUES.leagues, 'rollover', () => this.rolloverDue(), 1);
    this.sweeper.register('leagueRollover', () => this.rolloverDue());
    void this.queues.addRepeatable(QUEUES.leagues, 'rollover', { pattern: '0 0 * * 0', tz: 'Asia/Riyadh' });
  }

  /** Division a user plays in for a new week, from their most recent membership. */
  private async divisionFor(userId: string, ws: Date): Promise<number> {
    const last = await this.prisma.leagueMembership.findFirst({ where: { userId, weekStart: { lt: ws } }, orderBy: { weekStart: 'desc' } });
    if (!last) return MIN_DIVISION;
    return nextDivision(last.division, last.movement ?? 'STAY');
  }

  /** Joins the user's weekly group (idempotent). Groups fill to 30 in join order. */
  async join(userId: string, at: Date) {
    const ws = weekStart(at);
    const existing = await this.prisma.leagueMembership.findUnique({ where: { userId_weekStart: { userId, weekStart: ws } } });
    if (existing) return existing;
    const division = await this.divisionFor(userId, ws);
    return this.prisma.$transaction(async (tx) => {
      // serialize group assignment per (week, division)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`league:${ws.toISOString()}:${division}`}))`;
      const again = await tx.leagueMembership.findUnique({ where: { userId_weekStart: { userId, weekStart: ws } } });
      if (again) return again;
      const week = await tx.leagueWeek.upsert({ where: { weekStart: ws }, update: {}, create: { weekStart: ws } });
      const groups = await tx.leagueGroup.findMany({ where: { weekStart: ws, division }, include: { _count: { select: { memberships: true } } }, orderBy: { index: 'asc' } });
      let group = groups.find((g) => g._count.memberships < GROUP_SIZE);
      if (!group) {
        const created = await tx.leagueGroup.create({ data: { weekId: week.id, weekStart: ws, division, index: groups.length } });
        group = { ...created, _count: { memberships: 0 } };
      }
      return tx.leagueMembership.create({ data: { userId, weekStart: ws, division, groupId: group.id, joinedAt: at } });
    });
  }

  async applyDeltas(deltas: ScoreDelta[]) {
    const m = this.redis.client.multi();
    for (const d of deltas) {
      if (d.delta === 0 && d.before !== null) continue;
      const mem = await this.join(d.userId, d.weekStart);
      await this.prisma.leagueMembership.update({ where: { id: mem.id }, data: { weeklyPoints: { increment: d.delta } } });
      m.zincrby(lbKeys.week(d.weekStart), d.delta, d.userId);
      m.zincrby(lbKeys.season(d.seasonId), d.delta, d.userId);
      m.zincrby(lbKeys.category(d.seasonId, d.categoryId), d.delta, d.userId);
    }
    await m.exec();
  }

  /** Closes a finished week: ranks every group and records promotion/relegation. */
  async rollover(ws: Date) {
    const week = await this.prisma.leagueWeek.findUnique({ where: { weekStart: ws }, include: { groups: { include: { memberships: true } } } });
    if (!week || week.closedAt) return { closed: false };
    for (const g of week.groups) {
      const ranked = rankGroup(g.memberships.map((m) => ({ userId: m.userId, weeklyPoints: m.weeklyPoints, joinedAt: m.joinedAt })), g.division);
      for (const r of ranked) {
        await this.prisma.leagueMembership.update({ where: { userId_weekStart: { userId: r.userId, weekStart: ws } }, data: { finalRank: r.finalRank, movement: r.movement } });
      }
    }
    await this.prisma.leagueWeek.update({ where: { id: week.id }, data: { closedAt: this.clock.now() } });
    this.log.log(`closed week ${weekKey(ws)} (${week.groups.length} groups)`);
    return { closed: true, groups: week.groups.length };
  }

  /** Closes every week that ended (Sunday 00:00 Riyadh passed) and is still open. */
  async rolloverDue() {
    const current = weekStart(this.clock.now());
    const open = await this.prisma.leagueWeek.findMany({ where: { closedAt: null, weekStart: { lt: current } }, orderBy: { weekStart: 'asc' } });
    for (const w of open) await this.rollover(w.weekStart);
    return { closed: open.length };
  }

  /** The signed-in user's group this week, plus last week's result. */
  async myLeague(userId: string) {
    const now = this.clock.now();
    const ws = weekStart(now);
    const mem = await this.prisma.leagueMembership.findUnique({ where: { userId_weekStart: { userId, weekStart: ws } } });
    const last = await this.prisma.leagueMembership.findFirst({ where: { userId, weekStart: { lt: ws }, finalRank: { not: null } }, orderBy: { weekStart: 'desc' } });
    const lastWeek = last ? { rank: last.finalRank, movement: last.movement, division: last.division } : null;
    const endsAt = new Date(ws.getTime() + WEEK_MS);
    if (!mem) return { joined: false, division: await this.divisionFor(userId, ws), endsAt, lastWeek };
    const members = await this.prisma.leagueMembership.findMany({ where: { groupId: mem.groupId }, include: { user: { select: { nickname: true } } } });
    const ranked = rankGroup(members.map((m) => ({ userId: m.userId, weeklyPoints: m.weeklyPoints, joinedAt: m.joinedAt })), mem.division);
    const nick = new Map(members.map((m) => [m.userId, m.user.nickname]));
    return {
      joined: true,
      division: mem.division,
      endsAt,
      lastWeek,
      members: ranked.map((r) => ({ rank: r.finalRank, nickname: nick.get(r.userId), points: r.weeklyPoints, zone: r.movement, me: r.userId === userId })),
    };
  }

  /** Rebuilds Redis leaderboards from the Score table (recovery / after seeding). */
  async rebuildLeaderboards() {
    const keys = await this.redis.client.keys('lb:*');
    if (keys.length) await this.redis.client.del(...keys);
    const rows = await this.prisma.score.groupBy({ by: ['userId', 'weekStart', 'seasonId', 'categoryId'], _sum: { points: true } });
    const m = this.redis.client.multi();
    for (const r of rows) {
      const p = r._sum.points ?? 0;
      m.zincrby(lbKeys.week(r.weekStart), p, r.userId);
      m.zincrby(lbKeys.season(r.seasonId), p, r.userId);
      m.zincrby(lbKeys.category(r.seasonId, r.categoryId), p, r.userId);
    }
    await m.exec();
    return { rows: rows.length };
  }
}
