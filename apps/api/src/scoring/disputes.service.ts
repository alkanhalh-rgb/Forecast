import { HttpStatus, Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import { AuditService } from '../common/audit.service';
import { ClockService } from '../common/clock.service';
import { AppError, conflict, notFound } from '../common/errors';
import { DomainEvents } from '../common/events.service';
import { PrismaService } from '../common/prisma.service';
import { DISPUTE_WINDOW_MS } from '../questions/question.mapper';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService, private clock: ClockService, private audit: AuditService, private events: DomainEvents) {}

  /** "Report this result": only during the 12h dispute window, by someone who forecast on it, once. */
  async report(user: User, questionId: string, input: { evidenceUrl: string; message: string }) {
    const q = await this.prisma.question.findUnique({ where: { id: questionId }, include: { resolution: true } });
    if (!q) throw notFound();
    const r = q.resolution;
    const open = q.status === 'RESOLVED' && r?.resolvedAt && this.clock.now().getTime() < r.resolvedAt.getTime() + DISPUTE_WINDOW_MS;
    if (!open) throw new AppError('DISPUTE_WINDOW_CLOSED', HttpStatus.CONFLICT);
    const forecast = await this.prisma.forecast.findUnique({ where: { userId_questionId: { userId: user.id, questionId } } });
    if (!forecast) throw new AppError('FORBIDDEN', HttpStatus.FORBIDDEN);
    const existing = await this.prisma.dispute.findUnique({ where: { questionId_userId: { questionId, userId: user.id } } });
    if (existing) throw conflict('ALREADY_REPORTED');
    return this.prisma.dispute.create({ data: { questionId, userId: user.id, evidenceUrl: input.evidenceUrl, message: input.message } });
  }

  list(status?: string) {
    return this.prisma.dispute.findMany({
      where: status ? { status: status as 'OPEN' | 'UPHELD' | 'REJECTED' } : {},
      include: { question: { select: { id: true, textAr: true, textEn: true, status: true, options: true, resolution: true } }, user: { select: { nickname: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async decide(actor: User, id: string, decision: 'UPHELD' | 'REJECTED', note: string) {
    const d = await this.prisma.dispute.findUnique({ where: { id } });
    if (!d) throw notFound();
    if (d.status !== 'OPEN') throw new AppError('INVALID_STATE', HttpStatus.CONFLICT);
    const after = await this.prisma.dispute.update({ where: { id }, data: { status: decision, decision: note, decidedById: actor.id, decidedAt: this.clock.now() } });
    await this.audit.log({ actorId: actor.id, action: 'dispute.decide', entity: 'Dispute', entityId: id, before: d, after });
    await this.events.emit('dispute.decided', { disputeId: id });
    return after;
  }
}
