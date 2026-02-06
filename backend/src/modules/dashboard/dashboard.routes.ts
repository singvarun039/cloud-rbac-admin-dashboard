import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { ok } from "../../utils/apiResponse";
import { AppError } from "../../errors/AppError";
import { DashboardSummaryQuerySchema } from "../../validation/dashboard.schema";
import { utcDayRangeWindow } from "../../utils/dateWindow";
import { ZodError } from "zod";

export const dashboardRouter = Router();

function zodDetails(error: ZodError) {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
    fieldErrors: error.flatten().fieldErrors,
    formErrors: error.flatten().formErrors,
  };
}

dashboardRouter.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = DashboardSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "Bad request",
        zodDetails(parsed.error),
      );
    }

    const perms = new Set(req.user?.permissions ?? []);
    const canUsers = perms.has("users.read");
    const canRoles = perms.has("roles.read");
    const canProjects = perms.has("projects.read");
    const canAudit = perms.has("audit.read");

    if (!canUsers && !canRoles && !canProjects && !canAudit) {
      throw AppError.forbidden();
    }

    const { windowDays } = parsed.data;
    const { start, endExclusive, dates } = utcDayRangeWindow(windowDays);

    try {
      const [usersTotal, rolesTotal, projectsTotal] = await Promise.all([
        canUsers ? prisma.user.count() : Promise.resolve(null),
        canRoles ? prisma.role.count() : Promise.resolve(null),
        canProjects
          ? prisma.project.count({ where: { isArchived: false } })
          : Promise.resolve(null),
      ]);

      let auditTotalWindow: number | null = null;
      let auditTrend: Array<{ date: string; count: number }> = [];
      let recentAudit: Array<{
        id: string;
        action: string;
        entityType: string | null;
        entityId: string | null;
        actorUserId: string | null;
        actorEmail: string | null;
        createdAt: string;
      }> = [];

      if (canAudit) {
        const [auditTotal, trendRows, recent] = await Promise.all([
          prisma.auditLog.count({
            where: {
              createdAt: {
                gte: start,
                lt: endExclusive,
              },
            },
          }),
          prisma.$queryRaw<Array<{ date: string; count: number }>>`
            SELECT
              to_char(date_trunc('day', "createdAt") AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              CAST(count(*) AS int) AS count
            FROM "AuditLog"
            WHERE "createdAt" >= ${start} AND "createdAt" < ${endExclusive}
            GROUP BY 1
            ORDER BY 1 ASC
          `,
          prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              action: true,
              entityType: true,
              entityId: true,
              actorUserId: true,
              createdAt: true,
              actor: { select: { email: true } },
            },
          }),
        ]);

        auditTotalWindow = auditTotal;

        const trendByDate = new Map<string, number>();
        for (const row of trendRows) {
          trendByDate.set(row.date, Number(row.count) || 0);
        }

        auditTrend = dates.map((date) => ({
          date,
          count: trendByDate.get(date) ?? 0,
        }));

        recentAudit = recent.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType ?? null,
          entityId: a.entityId ?? null,
          actorUserId: a.actorUserId ?? null,
          actorEmail: a.actor?.email ?? null,
          createdAt: a.createdAt.toISOString(),
        }));
      }

      return ok(res, req, {
        kpis: {
          usersTotal,
          rolesTotal,
          projectsTotal,
          auditTotalWindow,
        },
        auditTrend,
        recentAudit,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, "INTERNAL", "Something went wrong");
    }
  }),
);
