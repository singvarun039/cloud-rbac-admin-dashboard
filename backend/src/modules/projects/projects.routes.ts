import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { ok } from "../../utils/apiResponse";
import { asyncHandler } from "../../middlewares/asyncHandler";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import {
  CreateProjectBodySchema,
  PatchProjectBodySchema,
  ProjectIdParamSchema,
  ProjectsListQuerySchema,
} from "../../validation/projects.schema";
import { AppError } from "../../errors/AppError";
import { writeAuditLog } from "../../services/auditLog.service";

export const projectsRouter = Router();

function normalizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, " ");
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

projectsRouter.get(
  "/",
  authenticate,
  requirePermission("projects.read"),
  validateQuery(ProjectsListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, search, ownerId, includeArchived } = req.query as any;

    const where: any = {};

    if (!includeArchived) {
      where.isArchived = false;
    }

    if (search) {
      where.name = { contains: String(search), mode: "insensitive" };
    }

    if (ownerId) {
      where.ownerId = String(ownerId);
    }

    const skip = (page - 1) * limit;

    const [total, projects] = await prisma.$transaction([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
  }),
);

projectsRouter.post(
  "/",
  authenticate,
  requirePermission("projects.write"),
  validateBody(CreateProjectBodySchema),
  asyncHandler(async (req, res) => {
    const { name, ownerId } = req.body as any;

    const normalizedName = normalizeProjectName(String(name));

    let project;
    try {
      project = await prisma.project.create({
        data: {
          name: normalizedName,
          ownerId: typeof ownerId === "string" ? ownerId : undefined,
        },
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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = (err.meta as any)?.target;
        if (Array.isArray(target) && target.includes("name")) {
          throw AppError.conflict("Project name already exists", {
            field: "name",
          });
        }
        throw AppError.conflict("Conflict", { target });
      }
      throw err;
    }

    await writeAuditLog({
      req,
      action: "PROJECT_CREATED",
      entityType: "PROJECT",
      entityId: project.id,
      actorUserId: req.user?.id ?? null,
      meta: {
        name: project.name,
        ...(project.ownerId ? { ownerId: project.ownerId } : {}),
      },
    });

    return ok(res, req, { project: projectToApi(project) }, 201);
  }),
);

projectsRouter.patch(
  "/:id",
  authenticate,
  requirePermission(["projects.write", "projects.edit"]),
  validateParams(ProjectIdParamSchema),
  validateBody(PatchProjectBodySchema),
  asyncHandler(async (req, res) => {
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

    if (!before) {
      throw AppError.notFound("Project not found");
    }

    const data: { name?: string; ownerId?: string | null } = {};

    if (typeof input.name === "string") {
      data.name = normalizeProjectName(input.name);
    }

    if (typeof input.ownerId === "string" || input.ownerId === null) {
      data.ownerId = input.ownerId;
    }

    let project;
    try {
      project = await prisma.project.update({
        where: { id: projectId },
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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = (err.meta as any)?.target;
        if (Array.isArray(target) && target.includes("name")) {
          throw AppError.conflict("Project name already exists", {
            field: "name",
          });
        }
        throw AppError.conflict("Conflict", { target });
      }
      throw err;
    }

    const changes: Record<string, { from: string | null; to: string | null }> =
      {};

    if (typeof input.name === "string" && before.name !== project.name) {
      changes.name = { from: before.name, to: project.name };
    }

    if (typeof input.ownerId === "string" || input.ownerId === null) {
      const beforeOwnerId = before.ownerId ?? null;
      const afterOwnerId = project.ownerId ?? null;
      if (beforeOwnerId !== afterOwnerId) {
        changes.ownerId = { from: beforeOwnerId, to: afterOwnerId };
      }
    }

    await writeAuditLog({
      req,
      action: "PROJECT_UPDATED",
      entityType: "PROJECT",
      entityId: project.id,
      actorUserId: req.user?.id ?? null,
      meta: { changes: Object.keys(changes).length > 0 ? changes : {} },
    });

    return ok(res, req, { project: projectToApi(project) }, 200);
  }),
);

projectsRouter.delete(
  "/:id",
  authenticate,
  requirePermission("projects.write"),
  validateParams(ProjectIdParamSchema),
  asyncHandler(async (req, res) => {
    const projectId = (req.params as any).id as string;

    const before = await prisma.project.findFirst({
      where: { id: projectId, isArchived: false },
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

    if (!before) {
      throw AppError.notFound("Project not found");
    }

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
      action: "PROJECT_ARCHIVED",
      entityType: "PROJECT",
      entityId: archived.id,
      actorUserId: req.user?.id ?? null,
      meta: {
        name: before.name,
        ...(before.ownerId ? { ownerId: before.ownerId } : {}),
      },
    });

    return ok(res, req, { success: true }, 200);
  }),
);
