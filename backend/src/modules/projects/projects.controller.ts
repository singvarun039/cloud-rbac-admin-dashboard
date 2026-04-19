import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/AppError';
import { ok } from '../../utils/apiResponse';
import { writeAuditLog } from '../../services/auditLog.service';
import type { Request, Response } from 'express';

function normalizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function projectToApi(project: {
  id: string;
  name: string;
  ownerId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    ownerId: project.ownerId,
    isArchived: project.isArchived,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function tryProjectCreate(data: { name: string; ownerId?: string }) {
  try {
    return await prisma.project.create({
      data: { name: data.name, ownerId: data.ownerId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta as any)?.target;
      if (Array.isArray(target) && target.includes('name'))
        throw AppError.conflict('Project name already exists', { field: 'name' });
      throw AppError.conflict('Conflict', { target });
    }
    throw err;
  }
}

async function tryProjectUpdate(id: string, data: { name?: string; ownerId?: string | null }) {
  try {
    return await prisma.project.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        ownerId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta as any)?.target;
      if (Array.isArray(target) && target.includes('name'))
        throw AppError.conflict('Project name already exists', { field: 'name' });
      throw AppError.conflict('Conflict', { target });
    }
    throw err;
  }
}

export async function listProjects(req: Request, res: Response) {
  const { page, limit, search, ownerId, includeArchived } = req.query as any;
  const where: any = {};
  if (!includeArchived) where.isArchived = false;
  if (search) where.name = { contains: String(search), mode: 'insensitive' };
  if (ownerId) where.ownerId = String(ownerId);
  const skip = (page - 1) * limit;
  const [total, projects] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        ownerId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  const items = projects.map((p) => projectToApi(p));
  const hasNext = page * limit < total;
  return ok(res, req, { items, meta: { page, limit, total, hasNext } }, 200);
}

export async function createProject(req: Request, res: Response) {
  const { name, ownerId } = req.body as any;
  const project = await tryProjectCreate({
    name: normalizeProjectName(String(name)),
    ownerId: typeof ownerId === 'string' ? ownerId : undefined,
  });
  await writeAuditLog({
    req,
    action: 'PROJECT_CREATED',
    entityType: 'PROJECT',
    entityId: project.id,
    actorUserId: req.user?.id ?? null,
    meta: { name: project.name, ...(project.ownerId ? { ownerId: project.ownerId } : {}) },
  });
  return ok(res, req, { project: projectToApi(project) }, 201);
}

export async function updateProject(req: Request, res: Response) {
  const projectId = (req.params as any).id as string;
  const input = req.body as any;

  const before = await prisma.project.findFirst({
    where: { id: projectId, isArchived: false },
    select: {
      id: true,
      name: true,
      ownerId: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!before) throw AppError.notFound('Project not found');

  const data: { name?: string; ownerId?: string | null } = {};
  if (typeof input.name === 'string') data.name = normalizeProjectName(input.name);
  if (typeof input.ownerId === 'string' || input.ownerId === null) data.ownerId = input.ownerId;

  const project = await tryProjectUpdate(projectId, data);

  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (typeof input.name === 'string' && before.name !== project.name)
    changes.name = { from: before.name, to: project.name };
  if (typeof input.ownerId === 'string' || input.ownerId === null) {
    const prev = before.ownerId ?? null,
      next = project.ownerId ?? null;
    if (prev !== next) changes.ownerId = { from: prev, to: next };
  }

  await writeAuditLog({
    req,
    action: 'PROJECT_UPDATED',
    entityType: 'PROJECT',
    entityId: project.id,
    actorUserId: req.user?.id ?? null,
    meta: { changes: Object.keys(changes).length > 0 ? changes : {} },
  });
  return ok(res, req, { project: projectToApi(project) }, 200);
}

export async function archiveProject(req: Request, res: Response) {
  const projectId = (req.params as any).id as string;
  const before = await prisma.project.findFirst({
    where: { id: projectId, isArchived: false },
    select: { id: true, name: true, ownerId: true },
  });
  if (!before) throw AppError.notFound('Project not found');
  const archived = await prisma.project.update({
    where: { id: projectId },
    data: { isArchived: true },
    select: {
      id: true,
      name: true,
      ownerId: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  await writeAuditLog({
    req,
    action: 'PROJECT_ARCHIVED',
    entityType: 'PROJECT',
    entityId: archived.id,
    actorUserId: req.user?.id ?? null,
    meta: { name: before.name, ...(before.ownerId ? { ownerId: before.ownerId } : {}) },
  });
  return ok(res, req, { success: true }, 200);
}
