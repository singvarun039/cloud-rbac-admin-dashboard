import { z } from "zod";

export const CreateUserBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export const UserIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const UpdateUserBodySchema = z
  .object({
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
    firstName: z.string().min(1).nullable().optional(),
    lastName: z.string().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
