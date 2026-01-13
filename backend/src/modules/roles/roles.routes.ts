import { Router } from "express";
import { prisma } from "../../db/prisma";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../services/auditLog.service";
import { asyncHandler } from "../../middlewares/asyncHandler";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import {
  AssignRoleBodySchema,
  CreateRoleBodySchema,
  PatchRoleBodySchema,
  PatchRoleParamsSchema,
  RolesListQuerySchema,
  RoleIdOrIdParamSchema,
  ReplaceRolePermissionsBodySchema,
} from "../../validation/roles.schema";
import { AppError } from "../../errors/AppError";

export const rolesRouter = Router();

function roleToApi(role: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  permissions?: Array<{ permission: { id: string; key: string } }>;
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    ...(role.permissions
      ? {
          permissions: role.permissions
            .map((rp) => rp.permission)
            .sort((a, b) => a.key.localeCompare(b.key)),
        }
      : {}),
  };
}

rolesRouter.get(
  "/",
  authenticate,
  requirePermission("roles.read"),
  validateQuery(RolesListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, search } = req.query as any;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { description: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, roles] = await prisma.$transaction([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          permissions: {
            select: {
              permission: { select: { id: true, key: true } },
            },
            orderBy: { permission: { key: "asc" } },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const items = roles.map((r) => roleToApi(r));
    return ok(res, req, { roles: items, page, limit, total, totalPages }, 200);
  })
);

rolesRouter.post(
  "/",
  authenticate,
  requirePermission("roles.write"),
  validateBody(CreateRoleBodySchema),
  asyncHandler(async (req, res) => {
    const { name, description } = req.body as {
      name: string;
      description?: string;
    };

    let role;
    try {
      role = await prisma.role.create({
        data: {
          name,
          description:
            typeof description === "string" && description.trim() === ""
              ? null
              : description,
        },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta as any)?.target;
        if (Array.isArray(target) && target.includes("name")) {
          throw AppError.conflict("Role name already exists", { field: "name" });
        }
        throw AppError.conflict("Conflict", { target });
      }
      throw err;
    }

    await writeAuditLog({
      req,
      action: "ROLE_CREATED",
      entityType: "ROLE",
      entityId: role.id,
      meta: { name: role.name, description: role.description },
    });

    return ok(res, req, { role: roleToApi(role) }, 201);
  })
);

rolesRouter.patch(
  "/:id",
  authenticate,
  requirePermission("roles.write"),
  validateParams(PatchRoleParamsSchema),
  validateBody(PatchRoleBodySchema),
  asyncHandler(async (req, res) => {
    const roleId = (req.params as any).id as string;
    const input = req.body as { name?: string; description?: string };

    const before = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!before) {
      throw AppError.notFound("Role not found");
    }

    const data: { name?: string; description?: string | null } = {};
    if (typeof input.name === "string") data.name = input.name;
    if (typeof input.description === "string") {
      data.description = input.description.trim() === "" ? null : input.description;
    }

    let role;
    try {
      role = await prisma.role.update({
        where: { id: roleId },
        data,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta as any)?.target;
        if (Array.isArray(target) && target.includes("name")) {
          throw AppError.conflict("Role name already exists", { field: "name" });
        }
        throw AppError.conflict("Conflict", { target });
      }
      throw err;
    }

    const changes: Record<
      string,
      { from: string | null; to: string | null }
    > = {};

    if (typeof input.name === "string" && before.name !== role.name) {
      changes.name = { from: before.name, to: role.name };
    }

    if (typeof input.description === "string") {
      const beforeDesc = before.description ?? null;
      const afterDesc = role.description ?? null;
      if (beforeDesc !== afterDesc) {
        changes.description = { from: beforeDesc, to: afterDesc };
      }
    }

    await writeAuditLog({
      req,
      action: "ROLE_UPDATED",
      entityType: "ROLE",
      entityId: role.id,
      meta: { changes: Object.keys(changes).length > 0 ? changes : {} },
    });

    return ok(res, req, { role: roleToApi(role) }, 200);
  })
);

rolesRouter.post(
  "/assign",
  authenticate,
  requirePermission("roles.write"),
  validateBody(AssignRoleBodySchema),
  asyncHandler(async (req, res) => {
    const { userId, roleId } = req.body as any;

    const [user, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.role.findUnique({
        where: { id: roleId },
        select: { id: true, name: true },
      }),
    ]);

    if (!user) throw AppError.notFound("User not found");
    if (!role) throw AppError.notFound("Role not found");

    try {
      await prisma.userRole.create({
        data: { userId, roleId },
      });
    } catch {
      // Idempotent: already assigned
    }

    await writeAuditLog({
      req,
      action: "ROLE_ASSIGNED",
      entityType: "User",
      entityId: userId,
      meta: { roleId: role.id, roleName: role.name },
    });

    return ok(res, req, { success: true }, 200);
  })
);

async function replaceRolePermissions(req: any, res: any) {
  const roleId = (req.params as any).id ?? (req.params as any).roleId;
  const input = req.body as { permissionKeys?: string[]; permissionIds?: string[] };

  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        permissions: {
          select: { permission: { select: { id: true, key: true } } },
        },
      },
    });

    if (!role) throw AppError.notFound("Role not found");

    const existing = role.permissions.map((rp) => rp.permission);
    const existingById = new Map(existing.map((p) => [p.id, p] as const));
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
        const invalidPermissionKeys = desiredKeys.filter((k) => !foundKeys.has(k));
        if (invalidPermissionKeys.length > 0) {
          throw AppError.validation({ invalidPermissionKeys });
        }

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
        const invalidPermissionIds = desiredIds.filter((id) => !foundIds.has(id));
        if (invalidPermissionIds.length > 0) {
          throw AppError.validation({ invalidPermissionIds });
        }

        desiredPermissions = found;
      }
    } else {
      // Should be unreachable due to Zod validation
      throw AppError.validation({ message: "Provide permissionKeys or permissionIds" });
    }

    desiredPermissions = desiredPermissions.sort((a, b) => a.key.localeCompare(b.key));

    const desiredIds = new Set(desiredPermissions.map((p) => p.id));
    const addedPermissions = desiredPermissions.filter((p) => !existingIds.has(p.id));
    const removedPermissions = existing.filter((p) => !desiredIds.has(p.id));

    await tx.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { in: removedPermissions.map((p) => p.id) },
      },
    });

    if (addedPermissions.length > 0) {
      await tx.rolePermission.createMany({
        data: addedPermissions.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    const finalPermissions = desiredPermissions;

    return {
      role: { id: role.id, name: role.name },
      addedKeys: addedPermissions.map((p) => p.key),
      removedKeys: removedPermissions.map((p) => p.key),
      finalPermissions,
      existingById,
    };
  });

  await writeAuditLog({
    req,
    action: "ROLE_PERMISSION_UPDATED",
    entityType: "ROLE",
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
      role: {
        id: result.role.id,
        name: result.role.name,
        permissions: result.finalPermissions,
      },
      addedKeys: result.addedKeys,
      removedKeys: result.removedKeys,
    },
    200
  );
}

rolesRouter.post(
  "/:id/permissions",
  authenticate,
  requirePermission("roles.write"),
  validateParams(RoleIdOrIdParamSchema),
  validateBody(ReplaceRolePermissionsBodySchema),
  asyncHandler(replaceRolePermissions)
);

// Back-compat: existing endpoint used PUT + :roleId param.
rolesRouter.put(
  "/:roleId/permissions",
  authenticate,
  requirePermission("roles.write"),
  validateParams(RoleIdOrIdParamSchema),
  validateBody(ReplaceRolePermissionsBodySchema),
  asyncHandler(replaceRolePermissions)
);
