import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { logWithReq } from '../lib/logger';

export type WriteAuditLogInput = {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  meta?: Prisma.InputJsonValue;
};

// Persists an audit log entry without blocking the caller on write failures.
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const { req, action, entityType } = input;

  const requestId = req.requestId ?? 'unknown';
  const actorUserId = input.actorUserId ?? req.user?.id ?? null;
  const ipAddress = req.ip ?? null;
  const userAgent = req.get('user-agent') ?? null;

  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId: input.entityId ?? null,
        actorUserId,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
        requestId,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    const error = err as { message?: string; stack?: string; name?: string };
    logWithReq(req, 'error', 'audit_write_failed', {
      action,
      entityType,
      entityId: input.entityId ?? null,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
}
