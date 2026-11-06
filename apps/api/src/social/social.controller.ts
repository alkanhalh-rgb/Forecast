import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { User } from '@app/db';
import { friendLeagueCreateSchema } from '@app/shared';
import { loadConfig } from '../config';
import { CurrentUser, Public, RateLimit } from '../common/decorators';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/zod';
import { DuelsService } from '../duels/duels.service';
import { ScoringService } from '../scoring/scoring.service';
import { AchievementsService } from './achievements.service';
import { FriendsService } from './friends.service';
import { NotificationsService } from './notifications.service';

const pushSchema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }) });

@Controller()
export class SocialController {
  constructor(
    private friends: FriendsService,
    private ach: AchievementsService,
    private notifications: NotificationsService,
    private scoring: ScoringService,
    private duels: DuelsService,
    private prisma: PrismaService,
  ) {}

  // ----- friend leagues -----
  @Post('friend-leagues')
  @RateLimit({ name: 'friend-league', limit: 10, windowSec: 3600 })
  create(@CurrentUser() u: User, @Body() body: unknown) {
    return this.friends.create(u, parse(friendLeagueCreateSchema, body).name);
  }

  @Get('friend-leagues')
  mine(@CurrentUser() u: User) {
    return this.friends.mine(u);
  }

  @Public()
  @Get('friend-leagues/code/:code')
  preview(@Param('code') code: string) {
    return this.friends.preview(code);
  }

  @Post('friend-leagues/join')
  @HttpCode(200)
  @RateLimit({ name: 'friend-join', limit: 20, windowSec: 3600 })
  join(@CurrentUser() u: User, @Body() body: unknown) {
    return this.friends.join(u, parse(z.object({ code: z.string().trim().min(4).max(16) }), body).code);
  }

  @Get('friend-leagues/:id')
  detail(@CurrentUser() u: User, @Param('id') id: string) {
    return this.friends.detail(u, id);
  }

  @Delete('friend-leagues/:id/membership')
  leave(@CurrentUser() u: User, @Param('id') id: string) {
    return this.friends.leave(u, id);
  }

  // ----- profile summary -----
  @Get('me/summary')
  async summary(@CurrentUser() u: User) {
    const [stats, streak, badges, rating, cards] = await Promise.all([
      this.scoring.stats(u.id),
      this.ach.streak(u.id),
      this.ach.badges(u.id),
      this.duels.myRating(u.id),
      this.prisma.shareCard.findMany({ where: { userId: u.id }, select: { id: true, kind: true, refId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { nickname: u.nickname, stats, streak, badges, duelRating: rating, shareCards: cards };
  }

  // ----- share cards (public images: they contain a nickname and a question only) -----
  @Public()
  @Get('share/:id.png')
  async card(@Param('id') id: string, @Res() res: Response) {
    const c = await this.prisma.shareCard.findUnique({ where: { id } });
    if (!c) throw notFound();
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.send(Buffer.from(c.image));
  }

  // ----- notifications -----
  @Get('notifications')
  inbox(@CurrentUser() u: User) {
    return this.notifications.inbox(u.id);
  }

  @Post('notifications/read')
  @HttpCode(200)
  async read(@CurrentUser() u: User) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, readAt: null, sentAt: { not: null } }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @Public()
  @Get('push/public-key')
  publicKey() {
    return { key: loadConfig().VAPID_PUBLIC_KEY || null };
  }

  @Post('push/subscribe')
  @HttpCode(200)
  async subscribe(@CurrentUser() u: User, @Body() body: unknown) {
    const s = parse(pushSchema, body);
    await this.prisma.pushSubscription.upsert({ where: { endpoint: s.endpoint }, update: { userId: u.id, p256dh: s.keys.p256dh, auth: s.keys.auth }, create: { userId: u.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth } });
    return { ok: true };
  }

  @Delete('push/subscribe')
  async unsubscribe(@CurrentUser() u: User) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId: u.id } });
    return { ok: true };
  }
}
