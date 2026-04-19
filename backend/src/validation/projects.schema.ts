import { z } from 'zod';

import { ListQuerySchema } from './list.schema';

export const ProjectIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const ProjectsListQuerySchema = ListQuerySchema.extend({
  ownerId: z.string().trim().min(1).optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
});

export const CreateProjectBodySchema = z.object({
  name: z.string().trim().min(1),
  ownerId: z.string().trim().min(1).optional(),
});

export const PatchProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    ownerId: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });
