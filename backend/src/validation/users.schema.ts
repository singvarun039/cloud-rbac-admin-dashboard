import { z } from 'zod';

import { ListQuerySchema } from './list.schema';

export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateUserBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8),
  name: z.string().trim().min(1),
  status: UserStatusSchema.optional().default('ACTIVE'),
  roleId: z.string().trim().min(1).optional(),
});

export const UserIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const UpdateUserBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((v) => v.toLowerCase())
      .optional(),
    name: z.string().trim().min(1).optional(),
    status: UserStatusSchema.optional(),
    roleId: z.string().trim().min(1).optional(),
    password: z.string().min(8).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });

export const UsersListQuerySchema = ListQuerySchema.extend({
  status: UserStatusSchema.optional(),
});
