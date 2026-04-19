import { z } from 'zod';

export const RolesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const RoleIdParamSchema = z.object({
  roleId: z.string().trim().min(1),
});

export const RoleIdOrIdParamSchema = z.union([
  z.object({ roleId: z.string().trim().min(1) }).strict(),
  z.object({ id: z.string().trim().min(1) }).strict(),
]);

const RoleNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .transform((v) => v.trim().replace(/\s+/g, ' ').toUpperCase());

export const CreateRoleBodySchema = z
  .object({
    name: RoleNameSchema,
    description: z.string().trim().max(255).optional(),
  })
  .strict();

export const PatchRoleParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const PatchRoleBodySchema = z
  .object({
    name: RoleNameSchema.optional(),
    description: z.string().trim().max(255).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });

// Builds a unique trimmed string-array validator for permission payloads.
const UniqueStringArray = (label: string) =>
  z
    .array(z.string().trim().min(1))
    .max(500)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: `Duplicate ${label} are not allowed`,
    });

export const UpdateRolePermissionsBodySchema = z
  .object({
    permissionKeys: UniqueStringArray('permission keys').default([]),
  })
  .strict();

export const ReplaceRolePermissionsBodySchema = z
  .object({
    permissionKeys: UniqueStringArray('permission keys')
      .transform((keys) => keys.map((k) => k.trim()))
      .optional(),
    permissionIds: UniqueStringArray('permission ids').optional(),
  })
  .strict()
  .refine(
    (v) =>
      (Array.isArray(v.permissionKeys) && !Array.isArray(v.permissionIds)) ||
      (!Array.isArray(v.permissionKeys) && Array.isArray(v.permissionIds)),
    {
      message: 'Provide exactly one of permissionKeys or permissionIds',
    }
  );

export const AssignRoleBodySchema = z.object({
  userId: z.string().trim().min(1),
  roleId: z.string().trim().min(1),
});
