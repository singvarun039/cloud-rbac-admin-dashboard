import { z } from 'zod';

const UniqueStringArray = (label: string) =>
  z
    .array(z.string().trim().min(1))
    .max(500)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: `Duplicate ${label} are not allowed`,
    });

export const PolicySimulationBodySchema = z
  .object({
    roleId: z.string().trim().min(1),
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
