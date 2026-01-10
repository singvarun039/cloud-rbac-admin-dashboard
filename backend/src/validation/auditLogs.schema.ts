import { z } from "zod";

export const AuditLogsListQuerySchema = z.object({
  actorUserId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});
