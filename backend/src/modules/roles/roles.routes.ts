import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { fail, ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../services/auditLog.service";

export const rolesRouter = Router();

rolesRouter.get(
  "/",
  authenticate,
  requirePermission("roles.read"),
  async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok(res, { roles }, 200);
  }
);

const AssignRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

rolesRouter.post(
  "/assign",
  authenticate,
  requirePermission("roles.write"),
  async (req, res) => {
    const parsed = AssignRoleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const { userId, roleId } = parsed.data;

    const [user, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.role.findUnique({
        where: { id: roleId },
        select: { id: true, name: true },
      }),
    ]);

    if (!user) return fail(res, 404, "NOT_FOUND", "User not found");
    if (!role) return fail(res, 404, "NOT_FOUND", "Role not found");

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

    return ok(res, { success: true }, 200);
  }
);

const UpdateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1)).max(500).default([]),
});

rolesRouter.put(
  "/:roleId/permissions",
  authenticate,
  requirePermission("roles.write"),
  async (req, res) => {
    const roleId = String(req.params.roleId ?? "").trim();
    if (!roleId) {
      return fail(res, 400, "VALIDATION_ERROR", "Role id is required");
    }

    const parsed = UpdateRolePermissionsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const desiredKeys = Array.from(
      new Set(parsed.data.permissionKeys.map((k) => k.trim()).filter(Boolean))
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

    if (!role) return fail(res, 404, "NOT_FOUND", "Role not found");

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
      {
        roleId,
        permissionKeys: desiredKeys,
        addedKeys,
        removedKeys,
      },
      200
    );
  }
);
