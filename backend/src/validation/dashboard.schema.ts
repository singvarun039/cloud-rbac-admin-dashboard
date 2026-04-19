import { z } from 'zod';

export const DashboardSummaryQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(90).default(14),
});
