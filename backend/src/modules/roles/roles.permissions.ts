import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/AppError';
import { ok } from '../../utils/apiResponse';
import { writeAuditLog } from '../../services/auditLog.service';
import type { Request, Response } from 'express';
import { PROTECTED_ROLE_NAMES } from './roles.helpers';

export async function replaceRolePermissions(req: Request, res: Response) {
  const roleId = (req.params as any).id ?? (req.params as any).roleId;
  const input = req.body as { permissionKeys?: string[]; permissionIds?: string[] };

  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        permissions: { select: { permission: { select: { id: true, key: true } } } },
      },
    });
    if (!role) throw AppError.notFound('Role not found');

    const existing = role.permissions.map((rp) => rp.permission);
    const existingIds = new Set(existing.map((p) => p.id));
    let desiredPermissions: Array<{ id: string; key: string }> = [];

    if (Array.isArray(input.permissionKeys)) {
      const desiredKeys = input.permissionKeys.map((k) => k.trim());
      if (desiredKeys.length > 0) {
        const found = await tx.permission.findMany({
          where: { key: { in: desiredKeys } },
          select: { id: true, key: true },
        });
        const foundKeys = new Set(found.map((p) => p.key));
        const invalid = desiredKeys.filter((k) => !foundKeys.has(k));
        if (invalid.length > 0) throw AppError.validation({ invalidPermissionKeys: invalid });
        desiredPermissions = found;
      }
    } else if (Array.isArray(input.permissionIds)) {
      const desiredIds = input.permissionIds;
      if (desiredIds.length > 0) {
        const found = await tx.permission.findMany({
          where: { id: { in: desiredIds } },
          select: { id: true, key: true },
        });
        const foundIds = new Set(found.map((p) => p.id));
        const invalid = desiredIds.filter((id) => !foundIds.has(id));
        if (invalid.length > 0) throw AppError.validation({ invalidPermissionIds: invalid });
        desiredPermissions = found;
      }
    } else {
      throw AppError.validation({ message: 'Provide permissionKeys or permissionIds' });
    }

    desiredPermissions = desiredPermissions.sort((a, b) => a.key.localeCompare(b.key));
    const desiredIdsSet = new Set(desiredPermissions.map((p) => p.id));
    const added = desiredPermissions.filter((p) => !existingIds.has(p.id));
    const removed = existing.filter((p) => !desiredIdsSet.has(p.id));

    await tx.rolePermission.deleteMany({
      where: { roleId, permissionId: { in: removed.map((p) => p.id) } },
    });
    if (added.length > 0) {
      await tx.rolePermission.createMany({
        data: added.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
    return {
      role: { id: role.id, name: role.name },
      addedKeys: added.map((p) => p.key),
      removedKeys: removed.map((p) => p.key),
      finalPermissions: desiredPermissions,
    };
  });

  await writeAuditLog({
    req,
    action: 'ROLE_PERMISSION_UPDATED',
    entityType: 'ROLE',
    entityId: result.role.id,
    meta: {
      roleName: result.role.name,
      added: result.addedKeys,
      removed: result.removedKeys,
      final: result.finalPermissions.map((p) => p.key),
    },
  });

  return ok(
    res,
    req,
    {
      role: { id: result.role.id, name: result.role.name, permissions: result.finalPermissions },
      addedKeys: result.addedKeys,
      removedKeys: result.removedKeys,
    },
    200
  );
}

export async function deleteRolePermanent(req: Request, res: Response) {
  const roleId = (req.params as any).id as string;
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, description: true },
  });
  if (!role) throw AppError.notFound('Role not found');
  if (PROTECTED_ROLE_NAMES.has(role.name))
    throw AppError.validation({ roleName: role.name }, 'System roles cannot be deleted');

  const assignedCount = await prisma.userRole.count({ where: { roleId } });
  if (assignedCount > 0)
    throw AppError.validation(
      { roleId, assignedCount },
      'Role is assigned to users; reassign users before deleting'
    );

  const permissionsCount = await prisma.rolePermission.count({ where: { roleId } });
  await prisma.role.delete({ where: { id: roleId } });

  await writeAuditLog({
    req,
    action: 'ROLE_DELETED',
    entityType: 'ROLE',
    entityId: roleId,
    meta: { roleId, name: role.name, description: role.description, permissionsCount },
  });
  return ok(
    res,
    req,
    {
      success: true,
      role: { id: roleId, name: role.name, description: role.description, permissionsCount },
    },
    200
  );
}
