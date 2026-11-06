import { HttpStatus, Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import { AppError } from '../common/errors';
import { decryptPhone } from '../common/crypto';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CrowdService } from '../questions/crowd.service';
import { options } from '../questions/question.mapper';

/** PDPL: data export and permanent account deletion. */
@Injectable()
export class PrivacyService {
  constructor(private prisma: PrismaService, private redis: RedisService, private crowd: CrowdService) {}

  async export(user: User) {
    const id = user.id;
    const [forecasts, history, scores, memberships, duels, rating, friendLeagues, streak, badges, disputes, notifications, pushSubscriptions] = await Promise.all([
      this.prisma.forecast.findMany({ where: { userId: id } }),
      this.prisma.forecastHistory.findMany({ where: { userId: id } }),
      this.prisma.score.findMany({ where: { userId: id } }),
      this.prisma.leagueMembership.findMany({ where: { userId: id } }),
      this.prisma.duel.findMany({ where: { OR: [{ challengerId: id }, { opponentId: id }] }, include: { questions: true } }),
      this.prisma.duelRating.findUnique({ where: { userId: id } }),
      this.prisma.friendLeagueMember.findMany({ where: { userId: id }, include: { league: { select: { name: true, inviteCode: true } } } }),
      this.prisma.streak.findUnique({ where: { userId: id } }),
      this.prisma.badgeAward.findMany({ where: { userId: id } }),
      this.prisma.dispute.findMany({ where: { userId: id } }),
      this.prisma.notification.findMany({ where: { userId: id } }),
      this.prisma.pushSubscription.findMany({ where: { userId: id }, select: { endpoint: true, createdAt: true } }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id,
        phone: decryptPhone(user.phoneEncrypted),
        nickname: user.nickname,
        city: user.city,
        interests: user.interests,
        role: user.role,
        ageConfirmedAt: user.ageConfirmedAt,
        consentLog: user.consentLog,
        createdAt: user.createdAt,
      },
      forecasts,
      forecastHistory: history,
      scores,
      leagueMemberships: memberships,
      duels,
      duelRating: rating,
      friendLeagues,
      streak,
      badges,
      disputes,
      notifications,
      pushSubscriptions,
    };
  }

  /** Hard delete (DECISIONS #23): DB rows cascade; Redis leaderboards and live crowd counters are cleaned. */
  async delete(user: User, confirmNickname: string) {
    if (!user.nickname || confirmNickname !== user.nickname) throw new AppError('VALIDATION', HttpStatus.BAD_REQUEST, 'nickname confirmation does not match');
    const live = await this.prisma.forecast.findMany({ where: { userId: user.id, question: { status: 'LIVE' } }, include: { question: true } });
    // remove from every leaderboard sorted set
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', 'lb:*', 'COUNT', 500);
      cursor = next;
      if (keys.length) {
        const m = this.redis.client.multi();
        for (const k of keys) m.zrem(k, user.id);
        await m.exec();
      }
    } while (cursor !== '0');
    await this.prisma.$transaction([
      this.prisma.auditLog.updateMany({ where: { actorId: user.id }, data: { actorId: null } }),
      this.prisma.forecastHistory.deleteMany({ where: { userId: user.id } }),
      this.prisma.user.delete({ where: { id: user.id } }),
    ]);
    for (const f of live) await this.crowd.apply(f.questionId, options(f.question).map((o) => o.id), f.optionId, null);
    return { deleted: true };
  }
}
