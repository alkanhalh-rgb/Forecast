import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import webpush from 'web-push';
import type { Prisma } from '@app/db';
import { isQuietHours, nextAllowedNotificationTime, NOTIFICATION_COPY, NotificationKind } from '@app/shared';
import { loadConfig } from '../config';
import { ClockService } from '../common/clock.service';
import { DomainEvents } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { QueueService, QUEUES } from '../jobs/queue.service';
import { SweeperService } from '../jobs/sweeper.service';
import { userRoom } from '../realtime/realtime.gateway';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * In-app inbox + Web Push. Nothing is delivered between 23:00 and 07:00 Riyadh: such
 * notifications are queued until 07:00 (rule 6).
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private log = new Logger('Notifications');
  private pushEnabled = false;

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private queues: QueueService,
    private sweeper: SweeperService,
    private events: DomainEvents,
    private rt: RealtimeService,
  ) {}

  onModuleInit() {
    const cfg = loadConfig();
    if (cfg.VAPID_PUBLIC_KEY && cfg.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(cfg.VAPID_SUBJECT, cfg.VAPID_PUBLIC_KEY, cfg.VAPID_PRIVATE_KEY);
      this.pushEnabled = true;
    }
    this.queues.register(QUEUES.notifications, 'send', (d: { id: string }) => this.send(d.id));
    this.sweeper.register('notificationsDue', () => this.sendDue());

    this.events.on('question.scored', async (e) => {
      const q = await this.prisma.question.findUnique({ where: { id: e.questionId } });
      if (!q) return;
      const params = { questionAr: q.textAr, questionEn: q.textEn };
      const url = `/q/${q.id}`;
      if (e.reason === 'VOIDED') {
        const fs = await this.prisma.forecast.findMany({ where: { questionId: q.id }, select: { userId: true } });
        for (const f of fs) await this.notify(f.userId, 'VOID', { ...params, reason: q.voidReason }, url);
      } else {
        for (const d of e.deltas) {
          if (e.reason === 'CORRECTED' && d.delta === 0) continue;
          await this.notify(d.userId, e.reason === 'RESOLVED' ? 'RESOLUTION' : 'CORRECTION', { ...params, points: d.after ?? 0 }, url);
        }
      }
    });
    this.events.on('duel.challenged', async (e) => {
      const d = await this.prisma.duel.findUnique({ where: { id: e.duelId }, include: { challenger: { select: { nickname: true } } } });
      if (d?.opponentId) await this.notify(d.opponentId, 'DUEL_CHALLENGE', { nickname: d.challenger.nickname }, `/duels/${d.id}`);
    });
    this.events.on('duel.decided', async (e) => {
      const d = await this.prisma.duel.findUnique({ where: { id: e.duelId } });
      if (!d?.opponentId) return;
      for (const uid of [d.challengerId, d.opponentId]) {
        const result = d.status === 'VOID' ? 'VOID' : !d.winnerId ? 'TIE' : d.winnerId === uid ? 'WON' : 'LOST';
        await this.notify(uid, 'DUEL_RESULT', { result }, `/duels/${d.id}`);
      }
    });
    this.events.on('dispute.decided', async (e) => {
      const d = await this.prisma.dispute.findUnique({ where: { id: e.disputeId }, include: { question: true } });
      if (d) await this.notify(d.userId, 'DISPUTE_DECISION', { questionAr: d.question.textAr, questionEn: d.question.textEn, decision: d.status }, `/q/${d.questionId}`);
    });
  }

  async notify(userId: string, kind: NotificationKind, params: Record<string, unknown>, url: string) {
    const now = this.clock.now();
    const deliverAt = nextAllowedNotificationTime(now);
    const n = await this.prisma.notification.create({
      data: { userId, kind, titleKey: `notifications.${kind}.title`, bodyKey: `notifications.${kind}.body`, params: params as Prisma.InputJsonValue, url, deliverAt },
    });
    const delay = deliverAt.getTime() - now.getTime();
    if (delay <= 0) await this.send(n.id);
    else await this.queues.add(QUEUES.notifications, 'send', { id: n.id }, { delayMs: delay, jobId: `notif-${n.id}` });
    return n;
  }

  /** Delivers one notification (push + live inbox ping) unless it is still quiet hours. */
  async send(id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.sentAt) return { sent: false };
    const now = this.clock.now();
    if (isQuietHours(now) || n.deliverAt > now) return { sent: false, deferred: true };
    await this.prisma.notification.update({ where: { id }, data: { sentAt: now } });
    await this.rt.publish(userRoom(n.userId), 'notification', { id: n.id, kind: n.kind });
    if (this.pushEnabled) {
      const subs = await this.prisma.pushSubscription.findMany({ where: { userId: n.userId } });
      const copy = NOTIFICATION_COPY[n.kind as NotificationKind];
      const payload = JSON.stringify({ title: copy.titleAr, body: copy.titleEn, url: n.url, lang: 'ar', dir: 'rtl' });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          else this.log.warn(`push failed: ${(e as Error).message}`);
        }
      }
    }
    return { sent: true };
  }

  async sendDue() {
    const now = this.clock.now();
    if (isQuietHours(now)) return { sent: 0, quiet: true };
    const due = await this.prisma.notification.findMany({ where: { sentAt: null, deliverAt: { lte: now } }, select: { id: true }, take: 500 });
    let sent = 0;
    for (const n of due) if ((await this.send(n.id)).sent) sent++;
    return { sent };
  }

  /** Inbox shows only delivered notifications (queued ones appear at 07:00). */
  inbox(userId: string) {
    return this.prisma.notification.findMany({ where: { userId, sentAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
