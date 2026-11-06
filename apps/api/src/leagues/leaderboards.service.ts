import { Injectable } from '@nestjs/common';
import { weekStart } from '@app/shared';
import { ClockService } from '../common/clock.service';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ScoringService } from '../scoring/scoring.service';
import { lbKeys } from './leagues.service';

export interface BoardRow {
  rank: number;
  nickname: string | null;
  points: number;
  me: boolean;
}

/** Leaderboards show nicknames only — never phone numbers or real names. */
@Injectable()
export class LeaderboardsService {
  constructor(private redis: RedisService, private prisma: PrismaService, private clock: ClockService, private scoring: ScoringService) {}

  private async fromZset(key: string, userId: string | null, limit = 100) {
    const raw = await this.redis.client.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    const ids: string[] = [];
    const pts: number[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      ids.push(raw[i]!);
      pts.push(Number(raw[i + 1]));
    }
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nickname: true } });
    const nick = new Map(users.map((u) => [u.id, u.nickname]));
    const rows: BoardRow[] = ids.map((id, i) => ({ rank: i + 1, nickname: nick.get(id) ?? null, points: pts[i]!, me: id === userId }));
    let mine: BoardRow | null = rows.find((r) => r.me) ?? null;
    if (!mine && userId) {
      const [rank, score] = await Promise.all([this.redis.client.zrevrank(key, userId), this.redis.client.zscore(key, userId)]);
      if (rank !== null && score !== null) mine = { rank: rank + 1, nickname: (await this.prisma.user.findUnique({ where: { id: userId } }))?.nickname ?? null, points: Number(score), me: true };
    }
    return { rows, mine };
  }

  week(userId: string | null) {
    return this.fromZset(lbKeys.week(weekStart(this.clock.now())), userId);
  }

  async season(userId: string | null) {
    const s = await this.scoring.currentSeason();
    return { season: { index: s.index, startsAt: s.startsAt, endsAt: s.endsAt }, ...(await this.fromZset(lbKeys.season(s.id), userId)) };
  }

  async category(slug: string, userId: string | null) {
    const cat = await this.prisma.category.findUnique({ where: { slug } });
    if (!cat) throw notFound();
    const s = await this.scoring.currentSeason();
    return this.fromZset(lbKeys.category(s.id, cat.id), userId);
  }

  /** Friends = everyone sharing at least one friend league with the user, plus the user (this week). */
  async friends(userId: string) {
    const ids = await this.friendIds(userId);
    return this.rankIds(ids, userId);
  }

  async friendIds(userId: string): Promise<string[]> {
    const leagues = await this.prisma.friendLeagueMember.findMany({ where: { userId }, select: { leagueId: true } });
    const members = await this.prisma.friendLeagueMember.findMany({ where: { leagueId: { in: leagues.map((l) => l.leagueId) } }, select: { userId: true } });
    return [...new Set([userId, ...members.map((m) => m.userId)])];
  }

  /** Ranks an explicit set of users by this week's points (ZMSCORE on the weekly set). */
  async rankIds(ids: string[], userId: string | null) {
    if (ids.length === 0) return { rows: [], mine: null };
    const scores = await this.redis.client.zmscore(lbKeys.week(weekStart(this.clock.now())), ...ids);
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nickname: true } });
    const nick = new Map(users.map((u) => [u.id, u.nickname]));
    const rows = ids
      .map((id, i) => ({ id, points: Number(scores[i] ?? 0) }))
      .sort((a, b) => b.points - a.points || (nick.get(a.id) ?? '').localeCompare(nick.get(b.id) ?? ''))
      .map((r, i): BoardRow => ({ rank: i + 1, nickname: nick.get(r.id) ?? null, points: r.points, me: r.id === userId }));
    return { rows, mine: rows.find((r) => r.me) ?? null };
  }
}
