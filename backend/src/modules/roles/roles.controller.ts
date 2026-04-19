import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/AppError';
import { ok } from '../../utils/apiResponse';
import { writeAuditLog } from '../../services/auditLog.service';
import type { Request, Response } from 'express';
import { roleToApi, PROTECTED_ROLE_NAMES } from './roles.helpers';

export async function listRoles(req: Request, res: Response) {
  const { page, limit, search } = req.query as any;
  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { description: { contains: String(search), mode: 'insensitive' } },
    ];
  }
  const skip = (page - 1) * limit;
  const [total, roles] = await prisma.$transaction([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: { permission: { select: { id: true, key: true } } },
          orderBy: { permission: { key: 'asc' } },
        },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const items = roles.map((r) => roleToApi(r));
  return ok(res, req, { roles: items, page, limit, total, totalPages }, 200);
}

export async function createRole(req: Request, res: Response) {
  const { name, description } = req.body as { name: string; description?: string };
  let role;
  try {
    role = await prisma.role.create({
      data: {
        name,
        description:
          typeof description === 'string' && description.trim() === '' ? null : description,
      },
      select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta as any)?.target;
      if (Array.isArray(target) && target.includes('name'))
        throw AppError.conflict('Role name already exists', { field: 'name' });
      throw AppError.conflict('Conflict', { target });
    }
    throw err;
  }
  await writeAuditLog({
    req,
    action: 'ROLE_CREATED',
    entityType: 'ROLE',
    entityId: role.id,
    meta: { name: role.name, description: role.description },
  });
  return ok(res, req, { role: roleToApi(role) }, 201);
}

export async function updateRole(req: Request, res: Response) {
  const roleId = (req.params as any).id as string;
  const input = req.body as { name?: string; description?: string };

  const before = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
  });
  if (!before) throw AppError.notFound('Role not found');

  const data: { name?: string; description?: string | null } = {};
  if (typeof input.name === 'string') data.name = input.name;
  if (typeof input.description === 'string')
    data.description = input.description.trim() === '' ? null : input.description;

  let role;
  try {
    role = await prisma.role.update({
      where: { id: roleId },
      data,
      select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta as any)?.target;
      if (Array.isArray(target) && target.includes('name'))
        throw AppError.conflict('Role name already exists', { field: 'name' });
      throw AppError.conflict('Conflict', { target });
    }
    throw err;
  }

  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (typeof input.name === 'string' && before.name !== role.name)
    changes.name = { from: before.name, to: role.name };
  if (typeof input.description === 'string') {
    const prev = before.description ?? null,
      next = role.description ?? null;
    if (prev !== next) changes.description = { from: prev, to: next };
  }
  await writeAuditLog({
    req,
    action: 'ROLE_UPDATED',
    entityType: 'ROLE',
    entityId: role.id,
    meta: { changes: Object.keys(changes).length > 0 ? changes : {} },
  });
  return ok(res, req, { role: roleToApi(role) }, 200);
}

export async function assignRole(req: Request, res: Response) {
  const { userId, roleId } = req.body as any;
  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } }),
  ]);
  if (!user) throw AppError.notFound('User not found');
  if (!role) throw AppError.notFound('Role not found');
  try {
    await prisma.userRole.create({ data: { userId, roleId } });
  } catch {
    /* Idempotent */
  }
  await writeAuditLog({
    req,
    action: 'ROLE_ASSIGNED',
    entityType: 'User',
    entityId: userId,
    meta: { roleId: role.id, roleName: role.name },
  });
  return ok(res, req, { success: true }, 200);
}
