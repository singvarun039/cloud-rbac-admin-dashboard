import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../errors/AppError';
import { DashboardSummaryQuerySchema } from '../../validation/dashboard.schema';
import { utcDayRangeWindow } from '../../utils/dateWindow';
import { ZodError } from 'zod';
import { getDashboardSummaryForPermissions } from '../../services/dashboardSummary.service';

export const dashboardRouter = Router();

// Converts a Zod error into structured validation details.
function zodDetails(error: ZodError) {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
    fieldErrors: error.flatten().fieldErrors,
    formErrors: error.flatten().formErrors,
  };
}

dashboardRouter.get(
  '/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = DashboardSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'BAD_REQUEST', 'Bad request', zodDetails(parsed.error));
    }

    const perms = new Set(req.user?.permissions ?? []);
    const canUsers = perms.has('users.read');
    const canRoles = perms.has('roles.read');
    const canProjects = perms.has('projects.read');
    const canAudit = perms.has('audit.read');

    if (!canUsers && !canRoles && !canProjects && !canAudit) {
      throw AppError.forbidden();
    }

    const { windowDays } = parsed.data;
    const { start, endExclusive, dates } = utcDayRangeWindow(windowDays);

    try {
      const summary = await getDashboardSummaryForPermissions({
        permissions: req.user?.permissions ?? [],
        start,
        endExclusive,
        dates,
      });

      return ok(res, req, summary);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, 'INTERNAL', 'Something went wrong');
    }
  })
);
