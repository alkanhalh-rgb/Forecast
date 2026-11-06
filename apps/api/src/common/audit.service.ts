import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/db';
import { PrismaService } from './prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

/** Every admin action is written here (spec: admin console). */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(entry: { actorId: string | null; action: string; entity: string; entityId: string; before?: unknown; after?: unknown }, tx: Tx = this.prisma) {
    return tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before === undefined ? undefined : (JSON.parse(JSON.stringify(entry.before)) as Prisma.InputJsonValue),
        after: entry.after === undefined ? undefined : (JSON.parse(JSON.stringify(entry.after)) as Prisma.InputJsonValue),
      },
    });
  }
}
