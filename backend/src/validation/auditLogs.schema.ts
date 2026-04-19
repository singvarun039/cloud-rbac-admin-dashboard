import { z } from 'zod';

const DateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid date',
  });

export const AuditLogsListQuerySchema = z.object({
  actorUserId: z.string().trim().min(1).optional(),
  actorEmail: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  dateFrom: DateStringSchema.optional(),
  dateTo: DateStringSchema.optional(),
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
