import { Router } from "express";
import { prisma } from "../../db/prisma";
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
  RolesListQuerySchema,
  RoleIdParamSchema,
  UpdateRolePermissionsBodySchema,
} from "../../validation/roles.schema";
import { AppError } from "../../errors/AppError";

export const rolesRouter = Router();

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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return ok(res, req, { roles, page, limit, total, totalPages }, 200);
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

rolesRouter.put(
  "/:roleId/permissions",
  authenticate,
  requirePermission("roles.write"),
  validateParams(RoleIdParamSchema),
  validateBody(UpdateRolePermissionsBodySchema),
  asyncHandler(async (req, res) => {
    const roleId = (req.params as any).roleId as string;

    const { permissionKeys } = req.body as { permissionKeys: string[] };
    const desiredKeys = Array.from(
      new Set((permissionKeys ?? []).map((k) => k.trim()).filter(Boolean))
    );

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        permissions: {
          select: {
            permission: { select: { id: true, key: true } },
          },
        },
      },
    });

    if (!role) throw AppError.notFound("Role not found");

    const existingKeys = role.permissions.map((rp) => rp.permission.key);
    const addedKeys = desiredKeys.filter((k) => !existingKeys.includes(k));
    const removedKeys = existingKeys.filter((k) => !desiredKeys.includes(k));

    const permissions = await Promise.all(
      desiredKeys.map((key) =>
        prisma.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key },
          select: { id: true, key: true },
        })
      )
    );

    const desiredPermissionIds = permissions.map((p) => p.id);

    await prisma.$transaction(async (tx) => {
      if (desiredPermissionIds.length === 0) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
      } else {
        await tx.rolePermission.deleteMany({
          where: {
            roleId,
            permissionId: { notIn: desiredPermissionIds },
          },
        });
      }

      await tx.rolePermission.createMany({
        data: desiredPermissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    });

    await writeAuditLog({
      req,
      action: "ROLE_PERMISSION_UPDATED",
      entityType: "Role",
      entityId: roleId,
      meta: { roleName: role.name, addedKeys, removedKeys },
    });

    return ok(
      res,
      req,
      {
        roleId,
        permissionKeys: desiredKeys,
        addedKeys,
        removedKeys,
      },
      200
    );
  })
);
