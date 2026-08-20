import { Injectable, Logger } from '@nestjs/common';
import { prisma, Prisma } from '@vaqt/db';

export type AuditSeverity = 'normal' | 'high';

export interface AuditLogInput {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  severity?: AuditSeverity;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(input: AuditLogInput): Promise<void> {
    const meta =
      input.severity === 'high'
        ? { ...input.meta, severity: 'high' }
        : input.meta;

    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: meta as Prisma.InputJsonValue | undefined,
      },
    });

    if (input.severity === 'high') {
      this.logger.warn(`[audit:high] ${input.action}`, meta);
    }
  }
}
