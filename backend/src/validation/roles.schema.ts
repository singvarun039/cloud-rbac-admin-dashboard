import { z } from "zod";

export const RolesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const RoleIdParamSchema = z.object({
  roleId: z.string().trim().min(1),
});

export const UpdateRolePermissionsBodySchema = z.object({
  permissionKeys: z.array(z.string().trim().min(1)).max(500).default([]),
});

export const AssignRoleBodySchema = z.object({
  userId: z.string().trim().min(1),
  roleId: z.string().trim().min(1),
});
