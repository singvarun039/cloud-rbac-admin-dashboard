import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/AppError';
import { ok } from '../../utils/apiResponse';
import { writeAuditLog } from '../../services/auditLog.service';

export async function permanentDeleteUser(req: Request, res: Response) {
  const userId = (req.params as any).id as string;

  if (req.user?.id && req.user.id === userId) {
    throw AppError.validation(
      { issues: [{ path: 'id', message: 'You cannot delete your own user', code: 'custom' }] },
      'Cannot delete self'
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!target) throw AppError.notFound('User not found');

  const isAdmin = target.roles.some((r) => r.role.name === 'ADMIN');
  if (isAdmin && target.isActive) {
    const activeAdminCount = await prisma.userRole.count({
      where: { role: { name: 'ADMIN' }, user: { isActive: true } },
    });
    if (activeAdminCount <= 1) {
      throw AppError.validation(
        {
          issues: [
            {
              path: 'id',
              message: 'Cannot delete the last remaining active ADMIN user',
              code: 'custom',
            },
          ],
        },
        'Cannot delete last admin'
      );
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  await writeAuditLog({
    req,
    action: 'USER_DELETED',
    entityType: 'USER',
    entityId: userId,
    actorUserId: req.user?.id ?? null,
    meta: {
      email: target.email,
      name: [target.firstName, target.lastName].filter(Boolean).join(' ') || null,
      status: target.isActive ? 'ACTIVE' : 'INACTIVE',
    },
  });

  return ok(res, req, { success: true }, 200);
}

export async function deactivateUser(req: Request, res: Response) {
  const userId = (req.params as any).id as string;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) throw AppError.notFound('User not found');
  if (!existing.isActive) return ok(res, req, { success: true }, 200);

  const disabled = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    req,
    action: 'USER_DEACTIVATED',
    entityType: 'USER',
    entityId: disabled.id,
    actorUserId: req.user?.id ?? null,
    meta: {
      email: disabled.email,
      name: [disabled.firstName, disabled.lastName].filter(Boolean).join(' ') || null,
      status: disabled.isActive ? 'ACTIVE' : 'INACTIVE',
    },
  });

  return ok(res, req, { success: true }, 200);
}
