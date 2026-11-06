import { HttpStatus, Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import { inviteCode } from '../common/crypto';
import { AppError, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { LeaderboardsService } from '../leagues/leaderboards.service';

export const FRIEND_LEAGUE_MAX = 50;

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService, private boards: LeaderboardsService) {}

  async create(user: User, name: string) {
    for (let i = 0; i < 5; i++) {
      try {
        return await this.prisma.friendLeague.create({ data: { name, ownerId: user.id, inviteCode: inviteCode(), members: { create: { userId: user.id } } } });
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e; // retry on invite-code collision
      }
    }
    throw new AppError('ERROR', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  async preview(code: string) {
    const l = await this.prisma.friendLeague.findUnique({ where: { inviteCode: code.toUpperCase() }, include: { _count: { select: { members: true } } } });
    if (!l) throw notFound();
    return { id: l.id, name: l.name, members: l._count.members, full: l._count.members >= FRIEND_LEAGUE_MAX };
  }

  /** Join by invite code. Max 50 members, enforced inside a row-locking transaction. */
  async join(user: User, code: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "FriendLeague" WHERE "inviteCode" = ${code.toUpperCase()} FOR UPDATE`;
      const id = rows[0]?.id;
      if (!id) throw notFound();
      const already = await tx.friendLeagueMember.findUnique({ where: { leagueId_userId: { leagueId: id, userId: user.id } } });
      if (already) return { id };
      const n = await tx.friendLeagueMember.count({ where: { leagueId: id } });
      if (n >= FRIEND_LEAGUE_MAX) throw new AppError('LEAGUE_FULL', HttpStatus.CONFLICT);
      await tx.friendLeagueMember.create({ data: { leagueId: id, userId: user.id } });
      return { id };
    });
  }

  async leave(user: User, id: string) {
    await this.prisma.friendLeagueMember.deleteMany({ where: { leagueId: id, userId: user.id } });
    return { ok: true };
  }

  async mine(user: User) {
    const ls = await this.prisma.friendLeague.findMany({ where: { members: { some: { userId: user.id } } }, include: { _count: { select: { members: true } } }, orderBy: { createdAt: 'desc' } });
    return ls.map((l) => ({ id: l.id, name: l.name, inviteCode: l.inviteCode, members: l._count.members, owner: l.ownerId === user.id }));
  }

  /** Weekly ranking for the group (weekly points from the Redis weekly leaderboard). */
  async detail(user: User, id: string) {
    const l = await this.prisma.friendLeague.findUnique({ where: { id }, include: { members: true } });
    if (!l) throw notFound();
    if (!l.members.some((m) => m.userId === user.id)) throw forbidden();
    const ranking = await this.boards.rankIds(l.members.map((m) => m.userId), user.id);
    return { id: l.id, name: l.name, inviteCode: l.inviteCode, members: l.members.length, max: FRIEND_LEAGUE_MAX, ...ranking };
  }
}
