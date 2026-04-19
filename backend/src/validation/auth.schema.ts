import { z } from 'zod';

export const LoginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
