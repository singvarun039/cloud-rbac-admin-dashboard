import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/AppError';
import { ok } from '../../utils/apiResponse';
import { hashPassword } from '../../utils/password';
import { writeAuditLog } from '../../services/auditLog.service';
import { nameToFirstLast, userToApi, ensureDefaultUserRole } from './users.helpers';

export async function listUsers(req: Request, res: Response) {
  const { page, limit, search, status } = req.query as any;

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: String(search), mode: 'insensitive' } },
      { firstName: { contains: String(search), mode: 'insensitive' } },
      { lastName: { contains: String(search), mode: 'insensitive' } },
    ];
  }
  if (status === 'ACTIVE') where.isActive = true;
  if (status === 'INACTIVE') where.isActive = false;

  const skip = (page - 1) * limit;

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          orderBy: { role: { name: 'asc' } },
          select: { role: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const items = users.map((u) => userToApi(u));
  const hasNext = page * limit < total;

  return ok(res, req, { items, meta: { page, limit, total, hasNext } }, 200);
}

export async function createUser(req: Request, res: Response) {
  const { email, password, name, status, roleId } = req.body as any;

  let requestedRoleId: string | null = null;
  if (typeof roleId === 'string' && roleId.trim()) {
    const role = await prisma.role.findUnique({
      where: { id: roleId.trim() },
      select: { id: true },
    });
    if (!role) {
      throw AppError.validation(
        { issues: [{ path: 'roleId', message: 'Role does not exist', code: 'custom' }] },
        'Invalid roleId'
      );
    }
    requestedRoleId = role.id;
  }

  const passwordHash = await hashPassword(password);
  const parsedName = nameToFirstLast(String(name));
  const isActive = status === 'ACTIVE';

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      isActive,
    },
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

  if (requestedRoleId) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: requestedRoleId } });
  } else {
    const defaultRole = await ensureDefaultUserRole();
    await prisma.userRole.create({ data: { userId: user.id, roleId: defaultRole.id } });
  }

  await writeAuditLog({
    req,
    action: 'USER_CREATED',
    entityType: 'USER',
    entityId: user.id,
    actorUserId: req.user?.id ?? null,
    meta: {
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
    },
  });

  return ok(res, req, { user: userToApi(user) }, 201);
}

export async function updateUser(req: Request, res: Response) {
  const userId = (req.params as any).id as string;
  const input = req.body as any;

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        orderBy: { role: { name: 'asc' } },
        select: { roleId: true, role: { select: { name: true } } },
      },
    },
  });

  if (!before) throw AppError.notFound('User not found');

  let requestedRoleId: string | null = null;
  let requestedRoleName: string | null = null;
  if (typeof input.roleId === 'string' && input.roleId.trim()) {
    const role = await prisma.role.findUnique({
      where: { id: input.roleId.trim() },
      select: { id: true, name: true },
    });
    if (!role) {
      throw AppError.validation(
        { issues: [{ path: 'roleId', message: 'Role does not exist', code: 'custom' }] },
        'Invalid roleId'
      );
    }
    requestedRoleId = role.id;
    requestedRoleName = role.name;
  }

  const data: any = {};
  if (typeof input.email === 'string') data.email = input.email;
  if (typeof input.status === 'string') data.isActive = input.status === 'ACTIVE';
  if (typeof input.password === 'string' && input.password)
    data.passwordHash = await hashPassword(input.password);
  if (typeof input.name === 'string') {
    const parsedName = nameToFirstLast(input.name);
    data.firstName = parsedName.firstName;
    data.lastName = parsedName.lastName;
  }

  const txOps: any[] = [
    prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ];

  if (requestedRoleId) {
    txOps.push(prisma.userRole.deleteMany({ where: { userId } }));
    txOps.push(prisma.userRole.create({ data: { userId, roleId: requestedRoleId } }));
  }

  const [user] = (await prisma.$transaction(txOps)) as any;

  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (typeof input.email === 'string' && input.email !== before.email)
    changes.email = { from: before.email, to: user.email };
  if (typeof input.status === 'string') {
    const prev = before.isActive ? 'ACTIVE' : 'INACTIVE';
    const next = user.isActive ? 'ACTIVE' : 'INACTIVE';
    if (prev !== next) changes.status = { from: prev, to: next };
  }
  if (typeof input.name === 'string') {
    const prev = [before.firstName, before.lastName].filter(Boolean).join(' ') || null;
    const next = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    if (prev !== next) changes.name = { from: prev, to: next };
  }
  if (requestedRoleId) {
    const beforeRoles = (before.roles ?? []).map((r: any) => r.role.name);
    changes.role = {
      from: beforeRoles.length > 0 ? beforeRoles.join(', ') : null,
      to: requestedRoleName ?? requestedRoleId,
    };
  }
  if (typeof input.password === 'string' && input.password)
    changes.password = { from: null, to: 'updated' };

  await writeAuditLog({
    req,
    action: 'USER_UPDATED',
    entityType: 'USER',
    entityId: user.id,
    actorUserId: req.user?.id ?? null,
    meta: { changes: Object.keys(changes).length > 0 ? changes : {} },
  });

  return ok(res, req, { user: userToApi(user) }, 200);
}


