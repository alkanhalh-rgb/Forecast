import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma, Question, User } from '@app/db';
import { Attestation, ATTESTATIONS, autoChecklist, buildFromTemplate, checklistPasses, QuestionInput, TemplateKey, TEMPLATES } from '@app/shared';
import { AuditService } from '../common/audit.service';
import { ClockService } from '../common/clock.service';
import { AppError, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { LifecycleService } from '../questions/lifecycle.service';
import { options } from '../questions/question.mapper';

const optionId = () => `o_${randomBytes(4).toString('hex')}`;

@Injectable()
export class AdminQuestionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private lifecycle: LifecycleService,
  ) {}

  list(status?: string) {
    return this.prisma.question.findMany({
      where: status ? { status: status as Question['status'] } : {},
      include: { category: true, resolution: true, createdBy: { select: { nickname: true } }, reviewedBy: { select: { nickname: true } }, _count: { select: { forecasts: true, disputes: true } } },
      orderBy: [{ lockAt: 'asc' }],
      take: 200,
    });
  }

  async get(id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { category: true, resolution: true, createdBy: { select: { id: true, nickname: true } }, reviewedBy: { select: { id: true, nickname: true } }, _count: { select: { forecasts: true } } },
    });
    if (!q) throw notFound();
    return { ...q, autoChecks: this.autoChecks(q, this.clock.now()) };
  }

  autoChecks(q: Pick<Question, 'textAr' | 'textEn' | 'sourceName' | 'sourceUrl' | 'lockAt' | 'resolveBy' | 'options'>, publishAt: Date) {
    return autoChecklist({ ...q, options: options(q as Question) }, publishAt);
  }

  private async validCategory(id: string) {
    if (!(await this.prisma.category.findUnique({ where: { id } }))) throw new AppError('VALIDATION', HttpStatus.BAD_REQUEST, 'unknown category');
  }

  async create(actor: User, input: QuestionInput, templateKey?: string) {
    await this.validCategory(input.categoryId);
    const q = await this.prisma.question.create({
      data: {
        categoryId: input.categoryId,
        textAr: input.textAr,
        textEn: input.textEn,
        options: input.options.map((o) => ({ id: optionId(), labelAr: o.labelAr, labelEn: o.labelEn })),
        lockAt: input.lockAt,
        resolveBy: input.resolveBy,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        status: 'DRAFT',
        createdById: actor.id,
        templateKey: templateKey ?? null,
      },
    });
    await this.audit.log({ actorId: actor.id, action: 'question.create', entity: 'Question', entityId: q.id, after: q });
    return q;
  }

  async createFromTemplate(actor: User, key: TemplateKey, params: Record<string, string>) {
    if (!TEMPLATES.some((t) => t.key === key)) throw notFound();
    const d = buildFromTemplate(key, params);
    if (Number.isNaN(d.lockAt.getTime()) || Number.isNaN(d.resolveBy.getTime())) throw new AppError('VALIDATION');
    const cat = await this.prisma.category.findUnique({ where: { slug: d.categorySlug } });
    if (!cat) throw new AppError('VALIDATION', HttpStatus.BAD_REQUEST, 'category missing');
    return this.create(actor, { categoryId: cat.id, textAr: d.textAr, textEn: d.textEn, options: d.options, lockAt: d.lockAt, resolveBy: d.resolveBy, sourceName: d.sourceName, sourceUrl: d.sourceUrl }, key);
  }

  async update(actor: User, id: string, input: QuestionInput) {
    const before = await this.prisma.question.findUnique({ where: { id } });
    if (!before) throw notFound();
    if (before.status !== 'DRAFT') throw new AppError('INVALID_STATE', HttpStatus.CONFLICT);
    if (before.createdById !== actor.id && actor.role !== 'ADMIN') throw forbidden();
    await this.validCategory(input.categoryId);
    // keep existing option ids where the position is unchanged
    const prevOpts = options(before);
    const after = await this.prisma.question.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        textAr: input.textAr,
        textEn: input.textEn,
        options: input.options.map((o, i) => ({ id: prevOpts[i]?.id ?? optionId(), labelAr: o.labelAr, labelEn: o.labelEn })),
        lockAt: input.lockAt,
        resolveBy: input.resolveBy,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
      },
    });
    await this.audit.log({ actorId: actor.id, action: 'question.update', entity: 'Question', entityId: id, before, after });
    return after;
  }

  private requireChecklist(q: Question, attest: Partial<Record<Attestation, boolean>>, publishAt: Date) {
    const auto = this.autoChecks(q, publishAt);
    if (!checklistPasses(auto, attest)) throw new AppError('CHECKLIST_INCOMPLETE', HttpStatus.UNPROCESSABLE_ENTITY, 'checklist incomplete', { auto, attestations: attest });
    return auto;
  }

  /** Editor completes the checklist and sends the draft to a reviewer. */
  async submit(actor: User, id: string, attest: Partial<Record<Attestation, boolean>>) {
    const q = await this.prisma.question.findUnique({ where: { id } });
    if (!q) throw notFound();
    if (q.status !== 'DRAFT') throw new AppError('INVALID_STATE', HttpStatus.CONFLICT);
    const now = this.clock.now();
    const auto = this.requireChecklist(q, attest, now);
    const checklist = { editor: { by: actor.id, at: now, auto, attestations: pickAttest(attest) } } as Prisma.InputJsonValue;
    const after = await this.prisma.question.update({ where: { id }, data: { status: 'REVIEW', checklist } });
    await this.audit.log({ actorId: actor.id, action: 'question.submit', entity: 'Question', entityId: id, before: { status: q.status }, after: { status: after.status, checklist } });
    return after;
  }

  /** A different person reviews: re-checks everything against the actual publish time, then publishes. */
  async approve(actor: User, id: string, attest: Partial<Record<Attestation, boolean>>) {
    const q = await this.prisma.question.findUnique({ where: { id } });
    if (!q) throw notFound();
    if (q.status !== 'REVIEW') throw new AppError('INVALID_STATE', HttpStatus.CONFLICT);
    if (q.createdById === actor.id) throw new AppError('SAME_PERSON', HttpStatus.FORBIDDEN, 'reviewer must differ from creator');
    const now = this.clock.now();
    const auto = this.requireChecklist(q, attest, now);
    const checklist = { ...((q.checklist as object) ?? {}), reviewer: { by: actor.id, at: now, auto, attestations: pickAttest(attest) } } as Prisma.InputJsonValue;
    const after = await this.prisma.question.update({ where: { id }, data: { status: 'LIVE', publishedAt: now, reviewedById: actor.id, checklist } });
    await this.lifecycle.scheduleLock(id, q.lockAt);
    await this.audit.log({ actorId: actor.id, action: 'question.publish', entity: 'Question', entityId: id, before: { status: q.status }, after: { status: after.status, publishedAt: now, checklist } });
    return after;
  }

  async reject(actor: User, id: string, note: string) {
    const q = await this.prisma.question.findUnique({ where: { id } });
    if (!q) throw notFound();
    if (q.status !== 'REVIEW') throw new AppError('INVALID_STATE', HttpStatus.CONFLICT);
    const after = await this.prisma.question.update({ where: { id }, data: { status: 'DRAFT' } });
    await this.audit.log({ actorId: actor.id, action: 'question.reject', entity: 'Question', entityId: id, before: { status: q.status }, after: { status: after.status, note } });
    return after;
  }
}

function pickAttest(a: Partial<Record<Attestation, boolean>>) {
  return Object.fromEntries(ATTESTATIONS.map((k) => [k, a[k] === true]));
}
